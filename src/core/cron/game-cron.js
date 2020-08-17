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

        new cron.CronJob("* * * * * *", () => proceed().catch(logger.logError), null, true);
    }

    async proceed() {
        const { durations } = this.gameDefinition;

        if (this.gameData.remainingTime == durations.wholeRound) {
            this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.gameData.remainingTime === durations.placingBets) {
            this.resetForNewRound();
            // definition.bot && (await definition.bot.reset());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;
            await this.settleGameRoundConsumer.settleRound(gameData);
        } else if (this.gameData.remainingTime < durations.placingBets) {
            // definition.bot && definition.bot.run(gameData);
            this.runningRoundInfoPublisher.publish(gameData);
        }
    }

    async checkGameStatus() {
        const { name: gameName, configName, durations } = this.gameDefinition;
        const configs = await gameConfigs.findOne({ name: configName }).lean().exec();
        const previouslyDisabled = this.gameData.disabled;

        this.gameData.gameConfigs = configs;
        this.gameData.disabled = !configs || !configs.enabled;

        if (gameData.disabled) {
            gameData.remainingTime = durations.wholeRound;
            this.gameStatusPublisher.publishDisableGameStatus(configs);
            await configs.updateOne({ name: gameName }, { disabledround: gameData.roundId });
        } else if (previouslyDisabled) {
            this.gameStatusPublisher.publishPreviousDisableGameStatus({ gameData: this.gameData, gameConfigs: configs });
        } else {
            this.gameStatusPublisher.publishStartGame(this.gameData);
        }
    }

    resetForNewRound() {
        this.gameData.inGame = {};
        this.gameData.totalBets = this.gameDefinition.defaultTotalBets();
    }
}
