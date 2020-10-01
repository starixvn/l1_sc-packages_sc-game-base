import cron from "cron";
import { gameConfigs } from "sc-base-database";
import { logger } from "sc-common";

import { SettleGameRoundConsumer } from "./../event-consumers";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseGameCron {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {GameStatusPublisher} gameStatusPublisher
     * @param {RunningRoundInfoPublisher} runningRoundInfoPublisher
     */
    constructor(definition, gameData, settleGameRoundConsumer = null, gameStatusPublisher = null, runningRoundInfoPublisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.settleGameRoundConsumer = settleGameRoundConsumer ?? new SettleGameRoundConsumer(definition, gameData);
        this.gameStatusPublisher = gameStatusPublisher ?? new GameStatusPublisher(definition.name, gameData);
        this.runningRoundInfoPublisher = runningRoundInfoPublisher ?? new RunningRoundInfoPublisher(definition.name, gameData);
    }

    async start() {
        const lastRound = await this.definition.roundRepository
            .findOne({}, "id", { sort: { _id: -1 } })
            .lean()
            .exec();
        const job = new cron.CronJob(
            "* * * * * *",
            () => this.proceed().catch(logger.logError),
            () => {
                logger.logError(
                    `${this.definition.name} unexpectedly stopped at round #${this.gameData.roundId} because some other tasks halt it.`
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
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.gameData.remainingTime === durations.placingBets) {
            this.resetForNewRound();
            this.definition.bot && (await this.definition.bot.reset());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;
            await this.settleGameRoundConsumer.settleRound(this.gameData);
        } else if (this.gameData.remainingTime < durations.placingBets) {
            this.definition.bot && (await this.definition.bot.run());
            this.runningRoundInfoPublisher.publish(this.gameData);
        }
    }

    async checkGameStatus() {
        const { configName, durations } = this.definition;
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

        this.gameData.gameConfigs = configs ?? {};
        this.gameData.disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (this.gameData.disabled) {
            this.gameData.remainingTime = durations.wholeRound;
            this.gameStatusPublisher.publishDisableGameStatus(this.gameData);
            await gameConfigs.updateOne({ name: configName }, { disabledround: this.gameData.roundId });
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
