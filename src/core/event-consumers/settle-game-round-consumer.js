import { endGame } from "sc-base-apis";

import { RoundResultPublisher, UserBetResultPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class SettleGameRoundConsumer {
    /**
     * @param {GameDefinition} gameDefinition
     * @param {GameData} gameData
     * @param {RoundResultPublisher} roundResultPublisher
     * @param {UserBetResultPublisher} userBetResultPublisher
     */
    constructor(gameDefinition, gameData, roundResultPublisher = null, userBetResultPublisher = null) {
        this.gameDefinition = gameDefinition;
        this.gameData = gameData;
        this.roundResultPublisher = roundResultPublisher ?? new RoundResultPublisher(gameDefinition.name, gameData);
        this.userBetResultPublisher = userBetResultPublisher ?? new UserBetResultPublisher(gameDefinition.name, gameData);
    }

    async settleRound() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;
        const result = this.gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : this.gameDefinition.generateResult();
        const settlementResult = this.gameDefinition.settle(result);
        const newRound = await this.gameDefinition.roundRepository.create({
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

    async queryBets(roundId) {}

    async settleBets({ result, settlementResult, roundId, time }) {
        const bets = await queryBets(roundId);

        if (bets && bets.length) {
            const { odds } = this.gameData.gameConfigs;

            await Promise.all(
                bets.map(async (bet) => {
                    const betResult = this.calculateBetResult(settlementResult, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.thanhtoan = true;

                    await bet.save();
                    await this.callEndGame(bet, roundId, time, betResult);
                    this.captureBetResult(bet, betResult);
                    this.userBetResultPublisher.publish(bet.uid, betResult);
                })
            );
        }

        this.roundResultPublisher.publishRoundResult(collectRoundResult(result, settlementResult, roundId));
    }

    calculateBetResult(settlementResult, bet, odds) {
        const betResult = Object.entries(settlementResult).reduce(
            (result, [choice, win]) => {
                const betAmount = bet[choice];
                let winAmount = win ? betAmount * (odds[choice] || 1) : 0;
                winAmount = bet.freeBet ? winAmount - betAmount : winAmount;

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
        return { result, settlementResult, roundId };
    }

    async callEndGame(bet, roundId, time, betResult) {
        const gameInfo = {
            gameId: this.gameDefinition.id,
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

        const apiResult = await endGame(bet.uid, gameInfo, settlementInfo);

        if (!apiResult.isOk) {
            this.userBetResultPublisher.publishApiError(bet.uid, apiResult.response);
        }
    }
}
