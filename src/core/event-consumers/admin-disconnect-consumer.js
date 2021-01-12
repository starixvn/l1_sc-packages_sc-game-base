import GameData from "./../game-data";

export default class AdminDisconnectConsumer {
    /**
     * @param {GameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient) {
        setTimeout(() => {
            delete this.gameData.admins[socketClient.id];
        });
    }
}
