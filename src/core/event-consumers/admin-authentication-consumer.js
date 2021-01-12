import { utils } from "sc-common";

import GameData from "./../game-data";

export default class AdminAuthenticationConsumer {
    /**
     * @param {GameData} gameData
     * @param {String} adminSecretKey
     */
    constructor(gameData, adminSecretKey) {
        this.gameData = gameData;
        this.adminSecretKey = adminSecretKey;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     * @param {string} token
     */
    consume(socketClient, token) {
        if (utils.authentication.adminAuthenticate(token, this.adminSecretKey)) {
            this.gameData.admins[socketClient.id] = { socketClient };
            socketClient.emit("message", { authorized: true });
        } else {
            socketClient.emit("message", { unauth: { message: "Authentication failed!" } });
        }
    }
}
