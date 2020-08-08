import _ from 'lodash';

export default class BaseUserDisconnectConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, storage) {
        const loggedUser = storage.loggedUsers[socketClient.id];

        if (loggedUser) {
            _.values(storage.loggedUsers).forEach((user) => {
                if (user.UID === loggedUser.UID && user.socketClient) {
                    delete storage.loggedUsers[user.socketClient.id];
                }
            });

            delete storage.loggedUsers[socketClient.id];
        }
    }
}
