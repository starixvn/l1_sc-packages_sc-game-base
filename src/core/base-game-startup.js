import bodyParser from "body-parser";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import { init as initApis } from "sc-base-apis";
import { gameConfigs, init as initBaseDatabase } from "sc-base-database";
import { logger, middlewares } from "sc-common";
import socketIo from "socket.io";

import { BaseGameCron } from "./crons";
import * as Bot from "./crons/bot";
import ProcessBetQueue from "./crons/process-bet-queue";
import GameData from "./game-data";
import GameDefinition from "./game-definition";

export default class BaseGameStartup {
    /**
     * @param {Object} appConfigs
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseGameCron} gameCron
     * @param {ProcessBetQueue} processBetQueue
     */
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue) {
        this.appConfigs = appConfigs;
        this.definition = definition;
        this.gameData = gameData;
        this.gameCron = gameCron ?? new BaseGameCron(definition, gameData);
        this.processBetQueue = processBetQueue ?? new ProcessBetQueue(definition, gameData);
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {}

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {}

    /**
     * @param {socketIo.Socket} socketClient
     */
    initAdminSocketRouter(socketClient) {}

    /**
     * @param {express.Express} app
     */
    async configureServices(app) {
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(morgan("combined"));
        app.use(helmet());

        if (this.appConfigs.enabledLogs) {
            logger.start(this.appConfigs.sentry);
        }

        await initBaseDatabase(this.appConfigs.database);
        await Bot.resetInRoom(this.definition.configName);
        initApis(this.appConfigs.apiSettings);
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
            console.log("Express server started and running!");
            await this.start();
        });

        middlewares.processErrorHandler.handle(httpServer, process);
    }

    async start() {
        try {
            this.gameData.gameConfigs = await gameConfigs.findOne({ name: this.definition.configName }).lean().exec();
            this.processBetQueue.start();
            this.gameCron.start();
        } catch (error) {
            logger.logError(error);
        }
    }
}
