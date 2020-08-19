import { Cron } from "./../../core";
import SettleGameRoundConsumer from "./../event-consumers/settle-game-round-consumer";

export default class TableGameCron extends Cron.BaseGameCron {
    constructor(gameDefinition, gameData, settleGameRoundConsumer = null) {
        super(gameDefinition, gameData, settleGameRoundConsumer ?? new SettleGameRoundConsumer(gameDefinition, gameData));
    }
}
