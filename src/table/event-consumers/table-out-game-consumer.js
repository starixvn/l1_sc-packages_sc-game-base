import UserDisconnectConsumer from "../../core/event-consumers/user-disconnect-consumer";
import BaseEventPublisher from "../../core/event-publishers/base-event-publisher";
import TableGameData from "../table-game-data";

export default class TableOutGameConsumer extends UserDisconnectConsumer {
    /**
     * @param {TableGameData} gameData
     * @param {BaseEventPublisher} publisher
     */
    constructor(gameData, publisher) {
        super(gameData);

        this.publisher = publisher;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            this.publisher.publishToAllUsers({ outgame: { playerId: realPlayer.UID } });
            delete this.gameData.players[realPlayer.UID];
        }

        super.consume(socketClient);
    }
}
