export default class BaseEventPublisher {
    constructor(storage, gameName) {
        this.storage = storage;
        this.gameName = gameName;
    }

    publishToAllUsers(payload) {
        const socketUsers = Object.values(this.storage.loggedUsers).map((user) => user.socketClient);

        socketUsers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToAllUsersExcept(userId, payload) {
        const socketUsers = Object.values(this.storage.loggedUsers)
            .filter((user) => user.UID !== userId)
            .map((user) => user.socketClient);

        socketUsers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToUser(userId, payload, path = this.gameName) {
        const user = Object.values(this.storage.loggedUsers).find(
            (loggedUser) => loggedUser.UID === userId && loggedUser.socketClient && loggedUser.socketClient.connected
        );

        if (user && user.socketClient) {
            user.socketClient.emit(path, payload);
        }
    }

    publishToAllAdmins(payload) {
        const socketAdmins = Object.values(this.storage.loggedAdmins).map((admin) => admin.socketClient);

        socketAdmins.forEach((socket) => {
            socket && socket.emit("message", { [this.gameName]: payload });
        });
    }
}
