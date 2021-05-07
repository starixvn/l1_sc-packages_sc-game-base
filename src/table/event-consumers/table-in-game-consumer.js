import InGameConsumer from "../../../src/core/event-consumers/in-game-consumer";

export default class TableInGameConsumer extends InGameConsumer {
    async consume(realPlayer) {
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled;
        if (disabled) {
            const disabledMessage = gameConfigs?.disabled_message ?? "";

            realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: disabledMessage });
        }

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

        const players = Object.values(this.gameData.players).reduce((playerList, player) => {
            const { id, name, red, avatarId, type, patternId } = player;

            playerList[id] = {
                id,
                name,
                red,
                avatarId,
                type: patternId > 0 ? false : type,
            };

            return playerList;
        }, {});

        delete players[realPlayer.UID];

        return {
            ...payload,
            remainingTime,
            players,
            chips,
        };
    }
}
