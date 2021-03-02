import { utils } from "sc-common";

import { AdminPublisher } from "./../event-publishers";
import GameData from "./../game-data";

export default class AdminAuthenticationConsumer {
    /**
     * @param {GameData} gameData
     * @param {String} adminSecretKey
     * @param {AdminPublisher} adminPublisher
     */
    constructor(gameData, adminSecretKey, adminPublisher) {
        this.gameData = gameData;
        this.adminSecretKey = adminSecretKey;
        this.adminPublisher = adminPublisher;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     * @param {string} token
     */
    consume(socketClient, token) {
        if (utils.authentication.adminAuthenticate(token, this.adminSecretKey)) {
            this.gameData.admins[socketClient.id] = { socketClient };
            this.adminPublisher.publishAuthorizedMessage(socketClient);
        } else {
            this.adminPublisher.publishUnauthorizedMessage(socketClient);
        }
    }
}
