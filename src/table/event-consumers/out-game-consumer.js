import { BaseEventConsumers, BaseEventPublishers } from "./../../core/index.js";

export default class OutGameConsumer extends BaseEventConsumers.BaseUserDisconnectConsumer {
    constructor(definition, gameData, publisher = null) {
        super();
        this.publisher = publisher ?? new BaseEventPublishers.BasePublisher(definition.name, gameData);
    }

    consume(socketClient, gameData) {
        const realPlayer = gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            delete gameData.players[realPlayer.UID];
            this.publisher.publishToAllUsers({ outgame: { playerId: realPlayer.UID } });
        }

        super.consume(socketClient, storage);
    }
}
