export default class BaseUserDisconnectConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, storage) {
        const loggedUser = storage.loggedUsers[socketClient.id];

        if (loggedUser) {
            delete storage.loggedUsers[socketClient.id];
        }
    }
}
