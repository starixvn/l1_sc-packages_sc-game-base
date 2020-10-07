import { getBalance } from "sc-base-apis";
import { userInfos } from "sc-base-database";

import { BasePublisher } from "./../event-publishers";
import { RoundQuery } from "./../query-apis";

export default class InGameConsumer {
    constructor({ definition, gameData, roundQuery, publisher }) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery ?? new RoundQuery(definition);
        this.publisher = publisher ?? new BasePublisher(definition.name, gameData);
    }

    async consume(realPlayer) {
        const payload = await this.buildPayload(realPlayer);
        const { user } = payload;

        if (!this.gameData.players[realPlayer.UID]) {
            this.gameData.players[realPlayer.UID] = {
                id: realPlayer.UID,
                name: realPlayer.profile.name,
                red: user.red,
                avatarId: user.avatarId,
                type: user.type,
            };
        }

        realPlayer.socketClient.emit(this.definition.name, payload);
    }

    async buildPayload(realPlayer) {
        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds, enableFreeBet } = this.gameData.gameConfigs;
        const { remainingTime, totalBets } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds, enableFreeBet };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const roundHistory = await this.roundQuery.getList(maxNumberOfRounds);
        await getBalance(realPlayer, true);
        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            roundHistory,
            remainingTime,
            ownBets,
            totalBets,
            user,
        };
    }

    getUserInfo(uid) {
        return userInfos
            .findOne(
                { id: uid },
                {
                    _id: false,
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
