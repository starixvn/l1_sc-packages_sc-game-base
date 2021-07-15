import { instrument } from "@socket.io/admin-ui";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import { init as initApis } from "sc-base-apis";
import { init as initBaseDatabase } from "sc-base-database";
import { logger, middlewares } from "sc-common";
import { Server } from "socket.io";

import { BaseStartup } from ".";
import { authenticationHelpers } from "./helpers";

export default class BaseGameApp {
    /**
     *
     * @param {string} serviceName
     * @param {*} appConfigs
     */
    constructor(serviceName, appConfigs) {
        this.serviceName = serviceName;
        this.appConfigs = appConfigs;
    }

    async run() {
        const app = express();
        await this.configureServices(app);
        app.get("/", (req, res, next) => {
            res.send(`I'm ${this.serviceName}. You'd better not touch me, babe!`);
        });

        const httpServer = http.createServer(app);
        const socketServer = this.initSocketServer(httpServer);

        httpServer.listen(app.get("port"), async () => {
            console.log(`Express server started and running on port ${app.get("port")}!`);
        });

        middlewares.processErrorHandler.handle(httpServer, process);

        this.app = app;
        this.socketServer = socketServer;
    }

    /**
     * @param {awilix.AwilixContainer} container
     */
    async startGame(container) {
        const gameStartUp = new BaseStartup(container);
        await gameStartUp.start(this.app, this.socketServer);
    }

    /**
     *
     * @param {http.Server} httpServer
     */
    initSocketServer(httpServer) {
        const { socketOptions, enableCorsWs, corsUrls } = this.appConfigs;
        const opts = socketOptions ?? { pingInterval: 25 * 1000, pingTimeout: 60 * 1000 };
        opts.allowEIO3 = true;
        opts.cors = {
            origin: enableCorsWs ? corsUrls : "*",
            credentials: true,
        };

        const socketServer = new Server(httpServer, opts);

        instrument(socketServer, { auth: false });

        return socketServer;
    }

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
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        app.use(morgan("combined"));
        app.use(helmet());
        app.set("port", process.env.PORT || this.appConfigs.hostingPort);

        if (this.appConfigs.enabledLogs) {
            logger.start(this.appConfigs.sentry);
        }

        await initBaseDatabase(this.appConfigs.database);
        await authenticationHelpers.init(this.appConfigs.mainServerApiSettings);
        await initApis(this.appConfigs.apiSettings);
    }
}
