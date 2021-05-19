import * as awilix from "awilix";
import bodyParser from "body-parser";
import express from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import { init as initApis } from "sc-base-apis";
import { init as initBaseDatabase } from "sc-base-database";
import { logger, middlewares } from "sc-common";
import socketIo from "socket.io";
import cors from "cors";

import { authenticationHelpers } from "./helpers";

export default class BaseGameStartup {
    dependencies = {
        appConfigs: "appConfigs",
        definition: "definition",
        gameData: "gameData",
        gameCron: "gameCron",
        processBetQueue: "processBetQueue",
        socketRouter: "socketRouter",
        adminSocketRouter: "adminSocketRouter",
        httpRouter: "httpRouter",
        gameConfigsRepository: "gameConfigsRepository",
    };

    /**
     * @param {awilix.AwilixContainer} container
     */
    //constructor(appConfigs, definition, gameData, gameCron, processBetQueue, bot = null) {
    constructor(container) {
        this.container = container;

        this.appConfigs = this.container.resolve(this.dependencies.appConfigs);
        this.definition = this.container.resolve(this.dependencies.definition);
        this.gameData = this.container.resolve(this.dependencies.gameData);
        this.gameCron = this.container.resolve(this.dependencies.gameCron);
        this.processBetQueue = this.container.resolve(this.dependencies.processBetQueue);
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = this.container.resolve(this.dependencies.socketRouter);

        router.init(socketClient);
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initAdminSocketRouter(socketClient) {
        const router = this.container.resolve(this.dependencies.adminSocketRouter);

        router.init(socketClient);
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
        const router = this.container.resolve(this.dependencies.httpRouter);

        router.init(app);
    }

    /**
     * @param {express.Express} app
     */
    async configureServices(app) {
        const corsOptions = {
            origin: (origin, callback) => {
                if (this.appConfigs.corsUrls.includes(origin) || !origin) {
                    callback(null, true);
                } else {
                    callback(new Error(`Not allowed by CORS ${origin}`));
                }
            },
        };

        app.use(cors(corsOptions));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(morgan("combined"));
        app.use(helmet());

        if (this.appConfigs.enabledLogs) {
            logger.start(this.appConfigs.sentry);
        }

        await initBaseDatabase(this.appConfigs.database);
        await authenticationHelpers.init(this.appConfigs.mainServerApiSettings);
        await initApis(this.appConfigs.apiSettings);
    }

    /**
     * @param {express.Express} app
     */
    async startServer(app) {
        const httpServer = http.createServer(app);
        const { hostingPort, socketOptions } = this.appConfigs;
        const gameNameInSocketNamespace = this.definition.name.toLowerCase();
        const socketServer = socketIo(httpServer, socketOptions ?? { pingInterval: 25 * 1000, pingTimeout: 60 * 1000 });

        app.set("port", process.env.PORT || hostingPort);
        app.get("/", (req, res, next) => {
            res.send(`I'm ${this.definition.name}. You'd better not touch me, babe!`);
        });

        this.initHttpRouter(app);

        socketServer.of(`/user/${gameNameInSocketNamespace}`).on("connection", (socketClient) => {
            this.initSocketRouter(socketClient);
        });

        socketServer.of(`/admin/${gameNameInSocketNamespace}`).on("connection", (socketClient) => {
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

        httpServer.listen(app.get("port"), async () => {
            console.log(`Express server started and running on port ${hostingPort}!`);
            await this.start();
        });

        middlewares.processErrorHandler.handle(httpServer, process);
    }

    async start() {
        try {
            const gameConfigsRepository = this.container.resolve(this.dependencies.gameConfigsRepository);

            this.gameData.gameConfigs = await gameConfigsRepository.findOne({ name: this.definition.configName }).lean().exec();

            await this.gameCron.start();
            this.processBetQueue.start();
        } catch (error) {
            logger.logError(error);
        }
    }
}
