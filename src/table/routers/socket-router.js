import BaseSocketRouter from "../../core/routers/socket-router.js";

export default class TableSocketRouter extends BaseSocketRouter {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(gameData, socketClient) {
        super.init(gameData, socketClient);
        this.socketClient.on("inGame", this.handleInGame.bind(this));
    }

    async handleInGame() {}
}
