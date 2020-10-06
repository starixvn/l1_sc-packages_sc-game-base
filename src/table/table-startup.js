import { BaseStartup } from "./../core";
import { TableGameCron, TableProcessBetQueue } from "./crons";

export default class TableStartup extends BaseStartup {
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new TableGameCron(definition, gameData, appConfigs.apiSettings),
            processBetQueue ?? new TableProcessBetQueue(definition, gameData)
        );
    }
}
