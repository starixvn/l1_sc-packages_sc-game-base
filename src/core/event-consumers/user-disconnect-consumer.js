export default class UserDisconnectConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, gameData) {
        delete gameData.realPlayers[socketClient.id];
    }
}
