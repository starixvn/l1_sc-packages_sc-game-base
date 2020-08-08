import bodyParser from 'body-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { init as initApis } from 'sc-base-apis';
import { gameConfigs, init as initBaseDatabase } from 'sc-base-database';
import { logger } from 'sc-common';
import * as Bot from './bot/index.js';

export default class BaseGameStartup {
    constructor(appConfigs, storage, startCron) {
        this.appConfigs = appConfigs;
        this.storage = storage;
        this.startCron = startCron;
    }

    configureServices = async (app) => {
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(morgan('combined'));
        app.use(helmet());

        if (this.appConfigs.enabledLogs) {
            logger.start(this.appConfigs.sentry);
        }

        await initBaseDatabase(this.appConfigs.database);
        await Bot.resetInRoom(this.appConfigs.gameName);
        initApis(this.appConfigs.apiSettings);
    };

    start = async () => {
        try {
            this.storage.gameConfigs = await gameConfigs.findOne({ name: this.appConfigs.gameName });
            this.startCron();
        } catch (error) {
            logger.logError(error);
        }
    };
}
