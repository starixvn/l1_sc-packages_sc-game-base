export default class UserDisconnectConsumer {
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient) {
        delete this.gameData.realPlayers[socketClient.id];
    }
}
