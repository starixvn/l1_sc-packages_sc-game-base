import * as awilix from "awilix";
import express from "express";
import { logger } from "sc-common";
import { Server, Socket } from "socket.io";

export default class BaseGameStartup {
    dependencies = {
        definition: "definition",
        gameData: "gameData",
        gameCron: "gameCron",
        processBetQueue: "processBetQueue",
        socketRouter: "socketRouter",
        adminSocketRouter: "adminSocketRouter",
        httpRouter: "httpRouter",
    };

    /**
     * @param {awilix.AwilixContainer} container
     */
    //constructor(appConfigs, definition, gameData, gameCron, processBetQueue, bot = null) {
    constructor(container) {
        this.container = container;

        this.definition = this.container.resolve(this.dependencies.definition);
        this.gameData = this.container.resolve(this.dependencies.gameData);
        this.gameCron = this.container.resolve(this.dependencies.gameCron);
        this.processBetQueue = this.container.resolve(this.dependencies.processBetQueue);
    }

    /**
     * @param {Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = this.container.resolve(this.dependencies.socketRouter);

        router.init(socketClient);
    }

    /**
     * @param {Socket} socketClient
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
     *
     * @param {express.Express} app
     * @param {Server} socketServer
     */
    async start(app, socketServer) {
        const gameNameInSocketNamespace = this.definition.name.toLowerCase();
        this.initHttpRouter(app);

        socketServer.of(`/user/${gameNameInSocketNamespace}`).on("connection", (socketClient) => {
            this.initSocketRouter(socketClient);
        });

        socketServer.of(`/admin/${gameNameInSocketNamespace}`).on("connection", (socketClient) => {
            this.initAdminSocketRouter(socketClient);
        });

        try {
            await this.gameCron.start();
            this.processBetQueue.start();
        } catch (error) {
            logger.logError(error);
        }
    }
}
