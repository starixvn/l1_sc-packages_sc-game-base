import { utils } from "sc-common";

import GameData from "./../game-data";

export default class AdminAuthenticationConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     * @param {GameData} gameData
     * @param {string} token
     * @param {string} secretKey
     */
    consume(socketClient, gameData, token, secretKey) {
        if (utils.authentication.adminAuthenticate(token, secretKey)) {
            gameData.admins[socketClient.id] = { socketClient };
            socketClient.emit("message", { authorized: true });
        } else {
            socketClient.emit("message", { unauth: { message: "Authentication failed!" } });
        }
    }
}
