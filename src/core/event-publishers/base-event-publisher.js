import GameData from "./../game-data";

export default class BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     */
    constructor(gameName, gameData) {
        this.gameName = gameName;
        this.gameData = gameData;
    }

    publishToAllUsers(payload) {
        const socketPlayers = Object.values(this.gameData.realPlayers).map((player) => player.socketClient);

        socketPlayers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToAllUsersExcept(userId, payload) {
        const socketPlayers = Object.values(this.gameData.realPlayers)
            .filter((player) => player.UID !== userId)
            .map((player) => player.socketClient);

        socketPlayers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    publishToUser(userId, payload, path = this.gameName) {
        const realPlayer = Object.values(this.gameData.realPlayers).find(
            (player) => player.UID === userId && player.socketClient && player.socketClient.connected
        );

        if (realPlayer && realPlayer.socketClient) {
            realPlayer.socketClient.emit(path, payload);
        }
    }

    publishToAllAdmins(payload) {
        const socketAdmins = Object.values(this.gameData.admins)
            .map((admin) => admin.socketClient)
            .filter((socket) => socket.connected);

        socketAdmins.forEach((socket) => {
            socket && socket.emit("message", { [this.gameName]: payload });
        });
    }

    publishApiError(userId, apiError) {
        this.publishToUser(userId, apiError);
    }
}
