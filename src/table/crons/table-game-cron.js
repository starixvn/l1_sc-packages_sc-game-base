import { Cron } from "./../../core";

export default class TableGameCron extends Cron.BaseGameCron {
    async start() {
        await super.start();
        await this.bot.resetInRoom();
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
