import { Cron } from "./../../core";
import TableSettleGameRoundConsumer from "./../event-consumers/table-settle-game-round-consumer";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";
import TableGameBot from "./table-game-bot";

export default class TableGameCron extends Cron.BaseGameCron {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableGameBot} bot
     * @param {TableSettleGameRoundConsumer} settleGameRoundConsumer
     * @param {GameStatusPublisher} gameStatusPublisher
     * @param {RunningRoundInfoPublisher} runningRoundInfoPublisher
     */
    constructor(
        definition,
        gameData,
        bot = null,
        settleGameRoundConsumer = null,
        gameStatusPublisher = null,
        runningRoundInfoPublisher = null
    ) {
        super(
            definition,
            gameData,
            bot,
            settleGameRoundConsumer ?? new TableSettleGameRoundConsumer(definition, gameData),
            gameStatusPublisher,
            runningRoundInfoPublisher
        );
    }

    resetForNewRound() {
        super.resetForNewRound();

        this.gameData.chips = {};
        this.gameData.winningPlayers = {};
    }
}
