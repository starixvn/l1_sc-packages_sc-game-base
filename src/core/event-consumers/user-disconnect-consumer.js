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
     */
    consume(socketClient) {
        setTimeout(() => {
            delete this.gameData.realPlayers[socketClient.id];
        });
    }
}
