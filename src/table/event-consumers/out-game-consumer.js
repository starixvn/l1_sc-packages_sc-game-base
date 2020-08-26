import { BaseEventConsumers, BaseEventPublishers } from "./../../core";

export default class OutGameConsumer extends BaseEventConsumers.UserDisconnectConsumer {
    constructor(definition, gameData, publisher = null) {
        super();
        this.gameData = gameData;
        this.publisher = publisher ?? new BaseEventPublishers.BasePublisher(definition.name, gameData);
    }

    consume(socketClient, reason) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            delete this.gameData.players[realPlayer.UID];
            this.publisher.publishToAllUsers({ outgame: { playerId: realPlayer.UID } });
        }

        super.consume(socketClient, reason);
    }
}
