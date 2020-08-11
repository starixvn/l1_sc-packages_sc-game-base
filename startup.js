import bodyParser from 'body-parser';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import morgan from 'morgan';
import { init as initApis } from 'sc-base-apis';
import { gameConfigs, init as initBaseDatabase } from 'sc-base-database';
import { logger } from 'sc-common';
import socketIo from 'socket.io';
import * as Bot from './bot/index.js';
import ProcessBetQueue from './cron/process-bet-queue.js';

export default class BaseGameStartup {
    constructor(gameName, appConfigs, storage, startCron, processBetQueue) {
        this.gameName = gameName;
        this.appConfigs = appConfigs;
        this.hostingPort = appConfigs.hostingPort;
        this.storage = storage;
        this.startCron = startCron;
        this.processBetQueue = processBetQueue ?? new ProcessBetQueue();
        this.socketOptions = this.appConfigs.socketOptions
            ?? { pingInterval: 25 * 1000, pingTimeout: 60 * 1000 };
    }

    /**
     * @param {express.Express} app
     */
    async configureServices(app) {
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
        middlewares.processErrorHandler.handle(httpServer, process);
    };

    /**
     * @param {express.Express} app
     */
    async startServer(app) {
        const httpServer = http.createServer(app);
        const socketServer = socketIo(httpServer, {
            pingInterval: this.socketOptions.pingInterval,
            pingTimeout: this.socketOptions.pingTimeout,
        });

        app.set('port', process.env.PORT || this.hostingPort);
        app.get('/', function (req, res, next) {
            res.send('Hello');
        });

        this.initHttpRouter(app);

        socketServer.of(`/user/${this.gameName}`).on('connection', (socketClient) => {
            this.initSocketRouter(socketClient);
        });

        socketServer.of(`/admin/${this.gameName}`).on('connection', (socketClient) => {
            this.initAdminSocketRouter(socketClient);
        });

        socketServer.origins((origin, callback) => {
            if (!this.appConfigs.enableCorsWs) {
                callback(null, true);
                return;
            }

            if ((this.appConfigs.corsUrls && this.appConfigs.corsUrls.indexOf(origin) !== -1) || !origin) {
                callback(null, true);
            } else {
                callback(`Not allowed by CORS ${origin}`, false);
            }
        });

        httpServer.listen(app.get('port'), async () => {
            console.log('Express server started and running!');
            await this.start();
        });
    }

    async start() {
        try {
            this.storage.gameConfigs = await gameConfigs.findOne({ name: this.appConfigs.gameName });
            this.processBetQueue.start(this.storage);
            this.startCron();
        } catch (error) {
            logger.logError(error);
        }
    };

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
    }

    /**
     * @param {express.Express} app
     */
    initSocketRouter(app) {
    }

    /**
     * @param {express.Express} app
     */
    initAdminSocketRouter(app) {
    }
}
