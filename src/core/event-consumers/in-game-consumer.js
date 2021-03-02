import mongoose from "mongoose";

import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { RoundQuery } from "./../query-apis";

export default class InGameConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {RoundQuery} roundQuery
     * @param {BaseEventPublisher} publisher
     * @param {*} getBalance
     * @param {mongoose.Model} userInfosRepository
     */
    constructor(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery;
        this.publisher = publisher;
        this.getBalance = getBalance;
        this.userInfosRepository = userInfosRepository;
    }

    async consume(realPlayer) {
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled;
        const disabledMessage = gameConfigs?.disabled_message ?? "";

        realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: disabledMessage });

        const payload = await this.buildPayload(realPlayer);

        this.publisher.publishToUser(realPlayer.UID, payload);
    }

    async buildPayload(realPlayer) {
        const { minbet, maxbet, choices_maxbet, odds, enableFreeBet } = this.gameData.gameConfigs;
        const { totalBets } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds, enableFreeBet };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const roundHistory = await this.roundQuery.getList(this.definition.numberOfRoundHistory);

        await this.getBalance(realPlayer, true);

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
        return this.userInfosRepository
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
