import { BaseEventConsumers, BaseEventPublishers } from "./../../core";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class OutGameConsumer extends BaseEventConsumers.UserDisconnectConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {BaseEventPublishers.BasePublisher} publisher
     */
    constructor(definition, gameData, publisher = null) {
        super(gameData);
        this.publisher = publisher ?? new BaseEventPublishers.BasePublisher(definition.name, gameData);
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
