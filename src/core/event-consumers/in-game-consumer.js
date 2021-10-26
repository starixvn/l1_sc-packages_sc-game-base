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
     * @param {mongoose.Model} currencyGroupGamesRepository
     * @param {mongoose.Model} exchangeRatesRepository
     */
    constructor(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository, currencyGroupGamesRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery;
        this.publisher = publisher;
        this.getBalance = getBalance;
        this.userInfosRepository = userInfosRepository;
        this.currencyGroupGamesRepository = currencyGroupGamesRepository;
    }

    async consume(realPlayer) {
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled || this.gameData.delayStartTime > 0;

        realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: this.gameData.umMessages });

        const payload = await this.buildPayload(realPlayer);

        this.publisher.publishToUser(realPlayer.UID, payload);
    }

    async buildPayload(realPlayer) {
        const { odds, enableFreeBet } = this.gameData.gameConfigs;
        const { totalBets, roundId, exchangeRates } = this.gameData;
        const { session } = realPlayer;
        const rate = exchangeRates.code[session.currencyCode] * session.multiplier;
        const settings = await this.currencyGroupGamesRepository
            .findOne({ groupId: session.currencyGroupId }, "minBet maxBet maxBetPerChoices chips stakeLevels")
            .lean()
            .exec();
        const gameConfigs = { ...settings, odds, enableFreeBet };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const roundHistory = await this.roundQuery.getList(this.definition.numberOfRoundHistory);

        await this.getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            roundId,
            gameConfigs,
            roundHistory,
            ownBets,
            totalBets,
            user: { ...user, rate },
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
