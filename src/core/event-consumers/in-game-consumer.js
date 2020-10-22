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
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled;
        const disabledMessage = gameConfigs?.disabled_message ?? "";

        realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: disabledMessage });

        const payload = await this.buildPayload(realPlayer);

        realPlayer.socketClient.emit(this.definition.name, payload);
    }

    async buildPayload(realPlayer) {
        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds, enableFreeBet } = this.gameData.gameConfigs;
        const { totalBets } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds, enableFreeBet };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const roundHistory = await this.roundQuery.getList(maxNumberOfRounds);

        await getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            roundHistory,
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
