import GameDefinition from "../game-definition.js";
import cron from "cron";
import { logger } from "sc-common";
import { gameConfigs } from "sc-base-database";

export default class GameCron {
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
            await settleRound();
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

    async settleRound() {}
}
