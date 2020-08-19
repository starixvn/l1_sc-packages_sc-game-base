import BaseGameStartup from "./../core/startup";
import TableGameCron from "./cron/game-cron";

export default class TableStartup extends BaseGameStartup {
    constructor(appConfigs, definition, gameData, gameCron) {
        super(appConfigs, definition, gameData, gameCron ?? new TableGameCron(definition, gameData));
    }
}
