import BaseSocketRouter from "../../core/routers/socket-router.js";

export default class MiniSocketRouter extends BaseSocketRouter {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(gameData, socketClient) {
        super.init(gameData, socketClient);
        this.socketClient.on("getTime", this.handleGetTime.bind(this));
        this.socketClient.on("getLogs", this.handleGetLogs.bind(this));
    }

    async handleGetTime(payload) {}

    async handleGetLogs(payload) {}
}
