import { BaseGameApp } from "./../core";
import TableStartup from "./table-startup";

export default class TableGameApp extends BaseGameApp {
    constructor(appConfigs, definition, gameData, startup) {
        super(appConfigs, definition, gameData, startup ?? new TableStartup(appConfigs, definition, gameData));
    }
}
