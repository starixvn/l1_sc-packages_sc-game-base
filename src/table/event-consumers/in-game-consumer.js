import { BaseEventConsumers } from "./../../core";

export default class InGameConsumer extends BaseEventConsumers.InGameConsumer {
    async consume(realPlayer) {
        super.consume(realPlayer);

        const player = this.gameData.players[realPlayer.UID];
        this.publisher.publishToAllUsersExcept(realPlayer.UID, { player });
    }

    async buildPayload(realPlayer) {
        const payload = await super.buildPayload(realPlayer);
        const { chips } = this.gameData;

        const players = { ...this.gameData.players };
        delete players[realPlayer.UID];

        return {
            ...payload,
            players,
            chips,
        };
    }
}
