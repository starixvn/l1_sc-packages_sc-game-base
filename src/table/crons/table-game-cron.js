import { Cron } from "./../../core";

export default class TableGameCron extends Cron.BaseGameCron {
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
