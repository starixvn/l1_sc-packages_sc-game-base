import { BaseEventPublisher } from "../../core/event-publishers/base-publisher";

export default class TableBaseEventPublisher extends BaseEventPublisher {
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
