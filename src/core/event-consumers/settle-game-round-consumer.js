import mongoose from "mongoose";

import GameManagementApiClientFactory, { callAndForget } from "../game-management-api";
import { RoundResultPublisher, UserBetResultPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class SettleGameRoundConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {RoundResultPublisher} dependencies.roundResultPublisher
     * @param {UserBetResultPublisher} dependencies.userBetResultPublisher
     * @param {*} dependencies.endGame
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     */
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        gameManagementApiClientFactory,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundResultPublisher = roundResultPublisher;
        this.userBetResultPublisher = userBetResultPublisher;
        this.endGame = endGame;
        this.roundsRepository = roundsRepository;
        this.betsRepository = betsRepository;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
    }

    async settleRound() {
        const result = this.generateResult();
        const settlementResult = this.definition.settle(result);
        const { roundId, exchangeRates } = this.gameData;
        const newRound = await this.roundsRepository.create({
            id: roundId,
            result,
            settlementResult,
            time: new Date(),
            exchangeRateId: exchangeRates.exId,
        });

        if (newRound) {
            this.roundResultPublisher.publishRoundResult(this.collectRoundResult(result, settlementResult, roundId));

            const finish = {
                settlementResult,
                result,
                roundId: newRound.id,
                time: newRound.time,
            };

            this.gameData.roundId = finish.roundId + 1;

            await this.settleBets(finish);

            this.roundResultPublisher.publishWinners(roundId, this.gameData.winningPlayers);
        }
    }

    generateResult() {
        if (this.gameData.result) {
            return this.gameData.result;
        } else {
            const resultFromAdmin = this.gameData.settlementResultFromAdmin;
            const { randomMode } = this.gameData.gameConfigs;
            return this.gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : this.definition.generateResult(randomMode);
        }
    }

    queryBets(roundId) {
        return this.betsRepository.find({ roundId }).exec();
    }

    async settleBets({ settlementResult, roundId, time, result }) {
        const bets = await this.queryBets(roundId);

        if (bets && bets.length) {
            await Promise.all(
                bets.map(async (bet) => {
                    const odds = bet.odds ?? this.gameData.gameConfigs.odds;

                    const betResult = this.calculateBetResult(settlementResult, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.paid = true;

                    await bet.save();
                    const metaData = this.createMetadata({bet, settlementResult, result});
                    await this.callEndGame(bet, roundId, time, betResult, metaData);

                    this.captureBetResult(bet.uid, betResult, bet.rate);
                    await this.userBetResultPublisher.publish(bet.uid, betResult);
                })
            );
        }
    }

    createMetadata(metaData) {
        return {};
    }

    calculateBetResult(settlementResult, bet, odds) {
        const betResult = Object.entries(settlementResult).reduce(
            (result, [choice, win]) => {
                const betAmount = bet[choice] ?? 0;
                const originalOdds = odds[choice] || 1;
                const effectiveOdds = bet.freeBet ? originalOdds - 1 : originalOdds;
                const winAmount = win ? betAmount * effectiveOdds : 0;

                result.totalBetAmount += betAmount;
                result.totalWin += winAmount;
                result.winningByChoices[choice] = winAmount;

                if (winAmount > 0) {
                    result.netWin += winAmount - betAmount;
                } else {
                    result.totalLost += betAmount;
                }

                return result;
            },
            {
                totalBetAmount: 0,
                totalWin: 0,
                netWin: 0,
                totalLost: 0,
                winningByChoices: {},
            }
        );

        betResult.totalWin = parseFloat(betResult.totalWin.toFixed(2));
        betResult.netWin = parseFloat(betResult.netWin.toFixed(2));

        return betResult;
    }

    captureBetResult(uid, betResult, rate) {}

    collectRoundResult(result, settlementResult, roundId) {
        return {
            result,
            settlementResult,
            roundId,
        };
    }

    async callEndGame(bet, roundId, time, betResult, metaData) {
        const { gameInfo, settlementInfo } = this.formatEndGameInfo(bet, roundId, time, betResult);

        const apiResult = await this.endGame(bet.uid, gameInfo, settlementInfo, metaData);

        if (apiResult.isOk) {
            settlementInfo.red > 0 &&
                callAndForget(this.gameManagementApiClient.users.updateBalance({ id: bet.uid, deductionAmount: -settlementInfo.red }));
        } else {
            this.userBetResultPublisher.publishApiError(bet.uid, apiResult.response);
        }
    }

    formatEndGameInfo(bet, roundId, time, betResult) {
        const gameInfo = {
            gameId: this.definition.id,
            gameRoundId: roundId,
            siteId: bet.siteId,
            time: time,
            operatorId: bet.operatorId,
            playerId: bet.playerId,
        };
        const settlementInfo = {
            redPlay: betResult.totalBetAmount,
            freeBet: bet.freeBet,
            promotionId: bet.promotionId,
        };

        if (betResult.totalWin > 0) {
            settlementInfo.red = betResult.totalWin;
        }

        return { gameInfo, settlementInfo };
    }
}
