export default class OutGameConsumer extends BaseEventConsumers.BaseUserDisconnectConsumer {
    constructor(publisher, storage, definition) {
        this.publisher = publisher ?? new BaseEventPublisher(storage, definition.name);
    }

    outGame(socketClient, gameData) {
        const realPlayer = gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            delete gameData.players[realPlayer.UID];
            publisher.publishToAllUsers({ outgame: { playerId: realPlayer.UID } });
        }

        super.consume(socketClient, storage);
    } 
}
