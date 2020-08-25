import cron from "cron";
import { gameConfigs } from "sc-base-database";
import { logger } from "sc-common";

import { SettleGameRoundConsumer } from "./../event-consumers";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseGameCron {
    /**
     * @param {GameDefinition} gameDefinition
     * @param {GameData} gameData
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
        const job = new cron.CronJob(
            "* * * * * *",
            () => this.proceed().catch(logger.logError),
            () => {
                Logger.logError(
                    `${this.gameDefinition.name} unexpectedly stopped at round #${this.gameData.roundId} because some other tasks halt it.`
                );
                job.start();
            }
        );

        if (lastRound) {
            this.gameData.roundId = lastRound.id + 1;
        }

        job.start();
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
            this.gameDefinition.bot && (await this.gameDefinition.bot.reset());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;
            await this.settleGameRoundConsumer.settleRound(this.gameData);
        } else if (this.gameData.remainingTime < durations.placingBets) {
            this.gameDefinition.bot && (await this.gameDefinition.bot.run());
            this.runningRoundInfoPublisher.publish(this.gameData);
        }
    }

    async checkGameStatus() {
        const { name: gameName, configName, durations } = this.gameDefinition;
        const configs = await gameConfigs.findOne({ name: configName }).lean().exec();
        const previouslyDisabled = this.gameData.disabled;
        const configuredlyDisabled = !configs || !configs.enabled;

        if (previouslyDisabled) {
            if (this.gameData.delayStartTime > 0) {
                this.gameData.delayStartTime--;
            } else if (!configuredlyDisabled) {
                this.gameData.delayStartTime = configs?.delayStartTime ?? 0;
            }
        }

        this.gameData.gameConfigs = configs;
        this.gameData.disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (this.gameData.disabled) {
            this.gameData.remainingTime = durations.wholeRound;
            this.gameStatusPublisher.publishDisableGameStatus(this.gameData);
            await gameConfigs.updateOne({ name: gameName }, { disabledround: this.gameData.roundId });
        } else if (previouslyDisabled) {
            this.gameStatusPublisher.publishPreviousDisableGameStatus(this.gameData);
        } else {
            this.gameStatusPublisher.publishStartGame(this.gameData);
        }
    }

    resetForNewRound() {
        this.gameData.ingame = {};
        this.gameData.totalBets = {};
    }
}
