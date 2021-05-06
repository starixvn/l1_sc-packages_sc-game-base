import InGameConsumer from "../../../src/core/event-consumers/in-game-consumer";
import { Systems } from "../../constants";

export default class TableInGameConsumer extends InGameConsumer {
    async consume(realPlayer) {
        const { session } = realPlayer;
        const { gameConfigs } = this.gameData;
        if (session.system === Systems.Mobi && (!gameConfigs || !gameConfigs.enabled)) {
            super.consume(realPlayer);
            return;
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
