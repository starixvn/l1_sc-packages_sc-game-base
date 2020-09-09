import GameData from "./../game-data";

export default class AdminDisconnectConsumer {
    /**
     * @param {GameData} gameData
     * @param {SocketIO.Socket} socketClient
     */
    consume(gameData, socketClient) {
        setTimeout(() => {
            delete gameData.admins[socketClient.id];
        });
    }
}
