import { AwilixContainer } from "awilix";
import express from "express";

import BaseStartup from "./base-game-startup";

export default class BaseGameApp {
    /**
     * @param {AwilixContainer} container
     * @param {BaseStartup} startup
     */
    constructor(container, startup) {
        this.container = container;
        this.startup = startup ?? new BaseStartup(container);
    }

    async run() {
        const app = express();

        await this.startup.configureServices(app);
        await this.startup.startServer(app);
    }
}
