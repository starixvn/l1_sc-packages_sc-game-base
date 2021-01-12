import { utils } from "sc-common";

import GameData from "./../game-data";

export default class AdminAuthenticationConsumer {
    /**
     * @param {GameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     * @param {string} token
     * @param {string} secretKey
     */
    consume(socketClient, token, secretKey) {
        if (utils.authentication.adminAuthenticate(token, secretKey)) {
            this.gameData.admins[socketClient.id] = { socketClient };
            socketClient.emit("message", { authorized: true });
        } else {
            socketClient.emit("message", { unauth: { message: "Authentication failed!" } });
        }
    }
}
