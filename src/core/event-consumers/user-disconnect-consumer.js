export default class BaseUserDisconnectConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, storage) {
        delete storage.loggedUsers[socketClient.id];
    }
}
