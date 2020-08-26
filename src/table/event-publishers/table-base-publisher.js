import { BasePublisher } from "./../../core/event-publishers";
import TableGameData from "./../table-game-data";

export default class TableBaseEventPublisher extends BasePublisher {
    /**
     * @param {string} gameName
     * @param {TableGameData} gameData
     */
    constructor(gameName, gameData) {
        super(gameName, gameData);
    }

    publishMessageBackToLobby(userId) {
        const user = Object.values(this.gameData.realPlayers).find(
            (player) => player.UID === userId && player.socketClient && player.socketClient.connected
        );

        if (user && user.socketClient) {
            user.socketClient.emit("message", { toGame: "MainGame" });
        }
    }
}
