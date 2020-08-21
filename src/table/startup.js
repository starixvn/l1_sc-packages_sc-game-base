import BaseGameStartup from "./../core/startup";
import TableGameCron from "./cron/game-cron";
import TableProcessBetQueue from "./cron/process-bet-queue";

export default class TableStartup extends BaseGameStartup {
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new TableGameCron(definition, gameData),
            processBetQueue ?? new TableProcessBetQueue(definition, gameData)
        );
    }
}
