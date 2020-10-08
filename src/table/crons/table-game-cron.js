import { Cron } from "./../../core";
import TableSettleGameRoundConsumer from "./../event-consumers/table-settle-game-round-consumer";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";
import TableGameBot from "./table-game-bot";

export default class TableGameCron extends Cron.BaseGameCron {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableSettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(definition, gameData, mainServerApiSettings, bot, settleGameRoundConsumer = null) {
        super(
            definition,
            gameData,
            mainServerApiSettings,
            bot ?? new TableGameBot(definition, gameData),
            settleGameRoundConsumer ?? new TableSettleGameRoundConsumer(definition, gameData, mainServerApiSettings)
        );
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
