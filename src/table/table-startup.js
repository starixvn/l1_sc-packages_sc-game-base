import { BaseStartup } from "./../core";
import { TableGameCron, TableProcessBetQueue } from "./crons";
import TableGameBot from "./crons/table-game-bot";
import { HttpRouter, SocketRouter } from "./routers";
import TableGameData from "./table-game-data";
import TableGameDefinition from "./table-game-definition";

export default class TableStartup extends BaseStartup {
    /**
     * @param {Object} appConfigs
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableGameCron} gameCron
     * @param {TableProcessBetQueue} processBetQueue
     * @param {TableGameBot} bot
     */
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue, bot = null) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new TableGameCron(definition, gameData, bot),
            processBetQueue ?? new TableProcessBetQueue(definition, gameData)
        );
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = new SocketRouter({ definition: this.definition, gameData: this.gameData });

        router.init(socketClient);
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
        const router = new HttpRouter(this.gameData);

        router.init(app, this.appConfigs);
    }
}
