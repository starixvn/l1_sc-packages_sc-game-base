import { BaseEventConsumers } from "./../../core";

export default class InGameConsumer extends BaseEventConsumers.InGameConsumer {
    async consume(realPlayer) {
        const payload = await this.buildPayload(realPlayer);
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: payload.user.red,
            avatarId: payload.user.avatarId,
            type: payload.user.type,
        };

        if (!this.gameData.players[realPlayer.UID]) {
            this.gameData.players[realPlayer.UID] = player;
        }

        realPlayer.socketClient.emit(this.definition.name, payload);
        this.publisher.publishToAllUsersExcept(realPlayer.UID, { player });
    }

    async buildPayload(realPlayer) {
        const payload = await super.buildPayload(realPlayer);
        const { remainingTime, chips } = this.gameData;
        const players = { ...this.gameData.players };

        delete players[realPlayer.UID];

        return {
            ...payload,
            remainingTime,
            players,
            chips,
        };
    }
}
