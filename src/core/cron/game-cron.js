import GameDefinition from "../game-definition.js";
import cron from "cron";
import { logger } from "sc-common";

export default class GameCron {
    /**
     * @param {GameDefinition} gameDefinition
     */
    constructor(gameDefinition, gameData) {
        this.gameDefinition = gameDefinition;
        this.gameData = gameData;
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

    async proceed() {
        const { durations } = this.gameDefinition;

        if (this.gameData.remainingTime == durations.wholeRound) {
            this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
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
        }
    }

    async checkGameStatus() {}

    resetForNewRound() {}

    async settleRound() {}
}
