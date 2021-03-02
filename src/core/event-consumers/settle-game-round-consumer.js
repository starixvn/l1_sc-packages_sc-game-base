import mongoose from "mongoose";

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
     */
    constructor({ definition, gameData, roundResultPublisher, userBetResultPublisher, endGame, roundsRepository, betsRepository }) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundResultPublisher = roundResultPublisher;
        this.userBetResultPublisher = userBetResultPublisher;
        this.endGame = endGame;
        this.roundsRepository = roundsRepository;
        this.betsRepository = betsRepository;
    }

    async settleRound() {
        const result = this.generateResult();
        const settlementResult = this.definition.settle(result);
        const newRound = await this.roundsRepository.create({
            id: this.gameData.roundId,
            result,
            settlementResult,
            time: new Date(),
        });

        if (newRound) {
            const finish = {
                settlementResult,
                result,
                roundId: newRound.id,
                time: newRound.time,
            };

            this.gameData.roundId = finish.roundId + 1;

            await this.settleBets(finish);
        }
    }

    generateResult() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;

        return this.gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : this.definition.generateResult();
    }

    queryBets(roundId) {
        return this.betsRepository.find({ phien: roundId }).exec();
    }

    async settleBets({ result, settlementResult, roundId, time }) {
        const bets = await this.queryBets(roundId);

        if (bets && bets.length) {
            const { odds } = this.gameData.gameConfigs;

            await Promise.all(
                bets.map(async (bet) => {
                    const betResult = this.calculateBetResult(settlementResult, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.thanhtoan = true;

                    await bet.save();
                    await this.callEndGame(bet, roundId, time, betResult);

                    this.captureBetResult(bet.uid, betResult);
                    await this.userBetResultPublisher.publish(bet.uid, betResult);
                })
            );
        }

        this.roundResultPublisher.publishRoundResult(this.collectRoundResult(result, settlementResult, roundId));
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

    captureBetResult(uid, betResult) {}

    collectRoundResult(result, settlementResult, roundId) {
        return {
            result,
            settlementResult,
            roundId,
        };
    }

    async callEndGame(bet, roundId, time, betResult) {
        const { gameInfo, settlementInfo } = this.formatEndGameInfo(bet, roundId, time, betResult);

        const apiResult = await this.endGame(bet.uid, gameInfo, settlementInfo);

        if (!apiResult.isOk) {
            this.userBetResultPublisher.publishApiError(bet.uid, apiResult.response);
        }
    }

    formatEndGameInfo(bet, roundId, time, betResult) {
        const gameInfo = {
            gameId: this.definition.id,
            gameRoundId: roundId,
            memberId: bet.memberId,
            siteId: bet.siteId,
            time: time,
        };
        const settlementInfo = {
            redPlay: betResult.totalBetAmount,
            freeBet: bet.freeBet,
        };

        if (betResult.totalWin > 0) {
            settlementInfo.red = betResult.totalWin;
        }

        if (betResult.netWin > 0) {
            settlementInfo.redWin = betResult.netWin;
        }

        if (betResult.totalLost > 0) {
            settlementInfo.redLost = betResult.totalLost;
        }

        return { gameInfo, settlementInfo };
    }
}
