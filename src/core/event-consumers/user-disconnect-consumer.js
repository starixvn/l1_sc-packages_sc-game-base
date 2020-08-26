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
        if (!this.ignoredDisconnectionReason.includes(reason)) {
            logger.setTag({ id: "ip-address", value: socketClient.handshake.address });
            logger.log(`Socket disconnected with the reason: ${reason}`);
            logger.setTag({ id: "ip-address", value: "" });
        }

        delete this.gameData.realPlayers[socketClient.id];
    }
}
