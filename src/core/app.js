import express from "express";

import GameData from "./game-data";
import GameDefinition from "./game-definition";
import BaseStartup from "./startup";

export default class BaseGameApp {
    /**
     * @param {Object} appConfigs
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseStartup} startup
     */
    constructor(appConfigs, definition, gameData, startup) {
        this.startup = startup ?? new BaseStartup(appConfigs, definition, gameData);
    }

    async run() {
        const app = express();

        await this.startup.configureServices(app);
        await this.startup.startServer(app);
    }
}
