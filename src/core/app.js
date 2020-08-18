import express from "express";
import BaseStartup from "./startup.js";
import { GameDefinition } from "./index.js";

export default class BaseGameApp {
    /**
     * @param {GameDefinition} definition
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
