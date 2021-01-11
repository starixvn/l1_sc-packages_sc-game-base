import { BaseEventConsumers, BaseEventPublishers } from "../../core";
import TableGameData from "../table-game-data";

export default class TableOutGameConsumer extends BaseEventConsumers.UserDisconnectConsumer {
    /**
     * @param {TableGameData} gameData
     * @param {BaseEventPublishers.BaseEventPublisher} publisher
     */
    constructor(gameData, publisher = null) {
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
