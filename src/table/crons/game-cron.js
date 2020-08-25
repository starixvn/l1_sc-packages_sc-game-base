import { Cron } from "./../../core";
import TableSettleGameRoundConsumer from "./../event-consumers/settle-game-round-consumer";
import GameData from "./../table-game-data";
import GameDefinition from "./../table-game-definition";

export default class TableGameCron extends Cron.BaseGameCron {
    /**
     * @param {GameDefinition} gameDefinition
     * @param {GameData} gameData
     * @param {TableSettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(gameDefinition, gameData, settleGameRoundConsumer = null) {
        super(gameDefinition, gameData, settleGameRoundConsumer ?? new TableSettleGameRoundConsumer(gameDefinition, gameData));
    }

    resetForNewRound() {
        this.gameData.ingame = {};
        this.gameData.totalBets = {};
        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
