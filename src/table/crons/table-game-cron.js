import BaseGameCron from "./../../core/crons/base-game-cron";

export default class TableGameCron extends BaseGameCron {
    async start() {
        await this.bot.resetInRoomTrackings();
        await super.start();
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
