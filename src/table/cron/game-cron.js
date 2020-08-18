import { BaseGameCron } from "../../core/cron";
import SettleGameRoundConsumer from "../event-consumers/settle-game-round-consumer.js";

export default class TableGameCron extends BaseGameCron {
    constructor(gameDefinition, gameData, settleGameRoundConsumer = null) {
        super(gameDefinition, gameData, settleGameRoundConsumer ?? new SettleGameRoundConsumer(gameDefinition, gameData));
    }
}
