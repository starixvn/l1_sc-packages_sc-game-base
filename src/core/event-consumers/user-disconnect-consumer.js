import { logger } from "sc-common";

import GameData from "./../game-data";

export default class UserDisconnectConsumer {
    ignoredDisconnectionReason = ["client namespace disconnect"];

    /**
     * @param {GameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     * @param {string} reason
     */
    consume(socketClient, reason) {
        const loggedUser = this.gameData.realPlayers[socketClient.id];

        if (!this.ignoredDisconnectionReason.includes(reason)) {
            logger.setTag({ id: "socket-io-id", value: socketClient.id });
            logger.setTag({ id: "username", value: loggedUser?.session?.username });
            logger.log(`Socket disconnected with the reason: ${reason}`);
            logger.setTag({ id: "socket-io-id", value: "" });
            logger.setTag({ id: "username", value: "" });
        }

        if (loggedUser) {
            delete this.gameData.realPlayers[socketClient.id];
        }
    }
}
