import { getBalance } from "sc-base-apis";
import { userInfos } from "sc-base-database";

import { BaseEventConsumers } from "../../core";

export default class InGameConsumer extends BaseEventConsumers.InGameConsumer {
    /**
     * @param {SocketIO.Client} socketClient
     */
    async consume(socketClient) {
        super.consume(socketClient);
        this.publisher.publishToAllUsersExcept(realPlayer.UID, { player });
    }

    async buildPayload() {
        const payload = await super.buildPayload();

        const { chips } = this.gameData;
        await getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);
        const players = { ...this.gameData.players };
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: user.red,
            avatarId: user.avatarId,
            type: user.type,
        };

        delete players[realPlayer.UID];

        if (!this.gameData.players[player.id]) {
            this.gameData.players[player.id] = player;
        }

        return {
            ...payload,
            players,
            chips,
            user,
        };
    }

    getUserInfo(uid) {
        return userInfos
            .findOne(
                { id: uid },
                {
                    UID: true,
                    name: true,
                    avatarId: true,
                    red: true,
                    scoins: true,
                    joinedOn: true,
                    security: true,
                    currency: true,
                    type: true,
                }
            )
            .lean()
            .exec();
    }
}
