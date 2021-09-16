import { Socket } from "socket.io";

import GameData from "./../game-data";

export default class UserDisconnectConsumer {
    /**
     * @param {GameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * @param {Socket} socketClient
     */
    consume(socketClient) {
        setTimeout(() => {
            delete this.gameData.realPlayers[socketClient.id];
        });
    }
}
