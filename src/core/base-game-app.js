import * as awilix from "awilix";
import express from "express";

import BaseStartup from "./base-game-startup";

export default class BaseGameApp {
    /**
     * @param {awilix.AwilixContainer} container
     * @param {BaseStartup} startup
     */
    constructor(container, startup = null) {
        this.container = container;
        this.startup = startup ?? new BaseStartup(container);
    }

    async run() {
        const app = express();

        await this.startup.configureServices(app);
        await this.startup.startServer(app);
    }
}
