import express from 'express';
import BaseStartup from './startup.js';

export default class BaseGameApp {
    /**
     * @param {BaseStartup} startup
     */
    constructor(gameName, storage, appConfigs, startup,
    ) {
        this.startup = startup ?? new BaseStartup(gameName, appConfigs, storage);
    }

    async run() {
        const app = express();

        await this.startup.configureServices(app);
        await this.startup.startServer(app);
    };
}
