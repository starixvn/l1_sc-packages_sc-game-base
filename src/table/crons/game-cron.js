import { Cron } from "./../../core";
import TableSettleGameRoundConsumer from "./../event-consumers/settle-game-round-consumer";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableGameCron extends Cron.BaseGameCron {
    /**
     * @param {TableGameDefinition} gameDefinition
     * @param {TableGameData} gameData
     * @param {TableSettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(gameDefinition, gameData, settleGameRoundConsumer = null) {
        super(gameDefinition, gameData, settleGameRoundConsumer ?? new TableSettleGameRoundConsumer(gameDefinition, gameData));
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
