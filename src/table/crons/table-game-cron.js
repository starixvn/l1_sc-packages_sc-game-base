import { Cron } from "./../../core";
import TableSettleGameRoundConsumer from "./../event-consumers/table-settle-game-round-consumer";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableGameCron extends Cron.BaseGameCron {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableSettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(definition, gameData, settleGameRoundConsumer = null) {
        super(definition, gameData, settleGameRoundConsumer ?? new TableSettleGameRoundConsumer(definition, gameData));
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
