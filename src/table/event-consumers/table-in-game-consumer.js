import InGameConsumer from "../../../src/core/event-consumers/in-game-consumer";
import { Systems } from "../../constants/systems";

export default class TableInGameConsumer extends InGameConsumer {
    async consume(realPlayer) {
        const { remainingTime, gameConfigs, umMessages } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled;
        if (disabled) {
            realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: umMessages });
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
        this.publisher.publishToAllUsersExceptSystem(Systems.Mobi, realPlayer.UID, { player });
    }

    async buildPayload(realPlayer) {
        const payload = await super.buildPayload(realPlayer);
        const { remainingTime, chips } = this.gameData;
        const players = realPlayer.session?.system === Systems.Mobi ? [] : this.buildPlayersPayload(realPlayer);

        return {
            ...payload,
            remainingTime,
            players,
            chips,
        };
    }

    buildPlayersPayload(realPlayer) {
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

        return players;
    }
}
