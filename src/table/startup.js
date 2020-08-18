import BaseGameStartup from "../core/startup.js";
import { TableGameCron } from "./index.js";

export default class TableStartup extends BaseGameStartup {
    constructor(appConfigs, definition, gameData, gameCron) {
        super(appConfigs, definition, gameData, gameCron ?? new TableGameCron(definition, gameData));
    }
}
