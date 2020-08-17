import GameDefinition from "../game-definition.js";
import cron from "cron";
import { logger } from "sc-common";
import { gameConfigs } from "sc-base-database";
import GameStatusPublisher from "../event-publishers/game-status-publisher.js";
import RunningRoundInfoPublisher from "../event-publishers/running-round-info-publisher.js";
import SettleGameRoundConsumer from "../event-consumers/settle-game-round-consumer.js";

export default class BaseGameCron {
    /**
     * @param {GameDefinition} gameDefinition
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(gameDefinition, gameData, settleGameRoundConsumer = null) {
        this.gameDefinition = gameDefinition;
        this.gameData = gameData;
        this.gameStatusPublisher = new GameStatusPublisher(gameDefinition.name, gameData);
        this.runningRoundInfoPublisher = new RunningRoundInfoPublisher(gameDefinition.name, gameData);
        this.settleGameRoundConsumer = settleGameRoundConsumer ?? new SettleGameRoundConsumer(gameDefinition, gameData);
    }

    async start() {
        const lastRound = await this.gameDefinition.roundRepository
            .findOne({}, "id", { sort: { _id: -1 } })
            .lean()
            .exec();

        if (!!lastRound) {
            this.gameData.roundId = lastRound.id + 1;
        }

        new cron.CronJob("* * * * * *", () => proceed(this.gameData).catch(logger.logError), null, true);
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
            await this.settleGameRoundConsumer.settleRound(gameData);
        } else if (gameData.remainingTime < durations.placingBets) {
            // definition.bot && definition.bot.run(gameData);
            this.runningRoundInfoPublisher.publish(gameData);
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
            this.gameStatusPublisher.publishDisableGameStatus(gameConfig);
            await gameConfigs.updateOne({ name: gameName }, { disabledround: gameData.roundId });
        } else if (previouslyDisabled) {
            this.gameStatusPublisher.publishPreviousDisableGameStatus({ gameData, gameConfig });
        } else {
            this.gameStatusPublisher.publishStartGame(gameData);
        }
    }

    resetForNewRound(gameData) {
        gameData.inGame = {};
        gameData.totalBets = this.gameDefinition.defaultTotalBets();
    }
}
