import _ from 'lodash';

export default class BaseEventPublisher {
    constructor(storage, gameName) {
        this.storage = storage;
        this.gameName = gameName;
    }

    publishToAllUsers(payload) {
        const socketUsers = _.values(this.storage.loggedUsers).map((user) => user.socketClient);
        socketUsers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToAllUsersExcept(userId, payload) {
        const socketUsers = _.values(this.storage.loggedUsers)
            .filter((user) => user.UID !== userId)
            .map((user) => user.socketClient);

        socketUsers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToUser(userId, payload, path = this.gameName) {
        const user = _.values(this.storage.loggedUsers).find(
            (user) => user.UID === userId && user.socketClient && user.socketClient.connected
        );

        if (user && user.socketClient) {
            user.socketClient.emit(path, payload);
        }
    }

    publishToAllAdmins(payload) {
        const socketAdmins = _.values(this.storage.loggedAdmins).map((admin) => admin.socketClient);
        socketAdmins.forEach((socket) => {
            socket && socket.emit('message', { [this.gameName]: payload });
        });
    }
}
