export default class BaseUserDisconnectConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, gameData) {
        delete gameData.realPlayers[socketClient.id];
    }
}
