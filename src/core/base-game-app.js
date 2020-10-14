import express from "express";

import BaseStartup from "./base-game-startup";
import GameData from "./game-data";
import GameDefinition from "./game-definition";
import * as authenticationHelper from "./helpers/authentication-helper";

export default class BaseGameApp {
    /**
     * @param {Object} appConfigs
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseStartup} startup
     */
    constructor(appConfigs, definition, gameData, startup) {
        this.appConfigs = appConfigs;
        this.startup = startup ?? new BaseStartup(appConfigs, definition, gameData);
    }

    async run() {
        const app = express();

        await this.startup.configureServices(app);
        await this.startup.startServer(app);
        await authenticationHelper.init(this.appConfigs.mainServerApiSettings);
    }
}
