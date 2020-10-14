import { BaseStartup } from "./../core";
import { TableGameCron, TableProcessBetQueue } from "./crons";
import { HttpRouter } from "./routers";

export default class TableStartup extends BaseStartup {
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new TableGameCron(definition, gameData),
            processBetQueue ?? new TableProcessBetQueue(definition, gameData)
        );
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
        const router = new HttpRouter(this.gameData);

        router.init(app, this.appConfigs);
    }
}
