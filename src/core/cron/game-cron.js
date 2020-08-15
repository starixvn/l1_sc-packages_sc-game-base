import GameDefinition from "../game-definition.js";
import cron from "cron";
import { logger } from "sc-common";
import { gameConfigs } from "sc-base-database";
import { endGame } from "sc-base-apis";

export default class BaseGameCron {
    /**
     * @param {GameDefinition} gameDefinition
     */
    constructor(gameDefinition) {
        this.gameDefinition = gameDefinition;
    }

    async start(gameData) {
        const lastRound = await this.gameDefinition.roundRepository
            .findOne({}, "id", { sort: { _id: -1 } })
            .lean()
            .exec();

        if (!!lastRound) {
            gameData.roundId = lastRound.id + 1;
        }

        new cron.CronJob("* * * * * *", () => proceed(gameData).catch(logger.logError), null, true);
    }

    async proceed(gameData) {
        const { durations } = this.gameDefinition;

        if (gameData.remainingTime == durations.wholeRound) {
            this.checkGameStatus(gameData);
        }

        if (!gameData.disabled) {
            gameData.remainingTime--;
        }

        if (gameData.remainingTime === durations.placingBets) {
            this.resetForNewRound();
            // definition.bot && (await definition.bot.reset());
        }

        if (gameData.remainingTime < 0) {
            gameData.remainingTime = durations.wholeRound;
            await settleRound(gameData);
        } else if (gameData.remainingTime < durations.placingBets) {
            // definition.bot && definition.bot.run(gameData);
            // pushRunningRoundInfoToAllRealPlayers(io, definition);
        }
    }

    async checkGameStatus(gameData) {
        const { name: gameName, configName: gameConfigName, durations } = this.gameDefinition;
        const gameConfig = await gameConfig.findOne({ name: gameConfigName }).lean().exec();
        const previouslyDisabled = gameData.disabled;

        gameData.gameConfigs = gameConfig;
        gameData.disabled = !gameConfigs || !gameConfigs.enabled;

        if (gameData.disabled) {
            gameData.remainingTime = durations.wholeRound;
            //gameStatusPublisher.publishDisableGameStatus(seDieConfigs);
            await gameConfigs.updateOne({ name: gameName }, { disabledround: gameData.roundId });
        } else if (previouslyDisabled) {
            //gameStatusPublisher.publishPreviousDisableGameStatus({ gameData, gameConfigs: seDieConfigs });
        } else {
            //gameStatusPublisher.publishStartGame(gameData);
        }
    }

    resetForNewRound(gameData) {
        gameData.inGame = {};
        gameData.totalBets = this.gameDefinition.defaultTotalBets();
    }

    async settleRound(gameData) {
        const resultFromAdmin = gameData.settlementResultFromAdmin;
        const result = gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : definition.generateResult();
        const settlementResult = this.gameDefinition.settle(result);
        const newRound = await definition.roundRepository.create({
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

            gameData.roundId = finish.roundId + 1;

            await settleBets(gameData, finish);
        }
    }

    async settleBets(gameData, { result, settlementResult, roundId, time }) {}

    calculateBetResult(settlementResult, bet, odds) {
        const betResult = Object.entries(settlementResult).reduce(
            (result, [choice, win]) => {
                const betAmount = bet[choice];
                const winAmount = win ? betAmount * (odds[choice] || 1) : 0;

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

    notifyBetResult = (gameData, bet, betResult) => {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
            gameData.winningPlayers[bet.uid] = status;

            if (gameData.players[bet.uid]) {
                gameData.players[bet.uid].red += betResult.totalWin;
                //updateBotBalance(bet.uid, gameData.usersAndBots[bet.uid].red);
            }
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        //userBetResultPublisher.publish({ bet, betResult: status });
        // TODO: Update user coin
        //     if (status.win && void 0 !== self.io.users[bet.uid]) {
        //         self.io.users[bet.uid].forEach(function (client) {
        //             User.updateCoint(client);
        //         });
        //     }
    };

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
