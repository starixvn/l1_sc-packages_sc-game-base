import { endGame } from "sc-base-apis";

import RoundResultPublisher from "../event-publishers/round-result-publisher";
import GameDefinition from "../game-definition";

export default class SettleGameRoundConsumer {
    /**
     * @param {GameDefinition} gameDefinition
     * @param {RoundResultPublisher} roundResultPublisher
     */
    constructor(gameDefinition, gameData, roundResultPublisher = null) {
        this.gameDefinition = gameDefinition;
        this.gameData = gameData;
        this.roundResultPublisher = roundResultPublisher ?? new RoundResultPublisher(gameDefinition.name, gameData);
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

    async settleBets({ result, settlementResult, roundId, time }) {}

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

    notifyBetResult(bet, betResult) {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
            this.gameData.winningPlayers[bet.uid] = status;

            if (this.gameData.players[bet.uid]) {
                this.gameData.players[bet.uid].red += betResult.totalWin;
                //updateBotBalance(bet.uid, gameData.usersAndBots[bet.uid].red);
            }
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        this.roundResultPublisher.publishToUser(bet.UID, { status });
        // TODO: Update user coin
        //     if (status.win && void 0 !== self.io.users[bet.uid]) {
        //         self.io.users[bet.uid].forEach(function (client) {
        //             User.updateCoint(client);
        //         });
        //     }
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
            //userBetResultPublisher.publishEndGameError(bet.uid, apiResult.response);
        }
    }
}
