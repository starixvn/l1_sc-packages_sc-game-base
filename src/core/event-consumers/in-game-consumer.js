import GameManagementApiClientFactory, { getOrDefault } from "../game-management-api";
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
     * @param {GameManagementApiClientFactory} gameManagementApiClientFactory
     */
    constructor(definition, gameData, roundQuery, publisher, getBalance, gameManagementApiClientFactory) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery;
        this.publisher = publisher;
        this.getBalance = getBalance;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
    }

    async consume(realPlayer) {
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled || this.gameData.delayStartTime > 0;

        realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: this.gameData.umMessages });

        const payload = await this.buildPayload(realPlayer);

        this.publisher.publishToUser(realPlayer.UID, payload);
    }

    async buildPayload(realPlayer) {
        const user = await this.getUserInfo(realPlayer);

        const { odds, originalOdds, enableFreeBet, boostedChoices } = this.gameData.gameConfigs;
        const { totalBets, roundId, exchangeRates } = this.gameData;
        const { session } = realPlayer;
        const rate = exchangeRates.code[session.currencyCode] * session.multiplier;
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === session.currencyGroupId);
        const gameConfigs = { ...settings, odds, originalOdds, enableFreeBet, boostedChoices };
        const { ownBets, clientSeed } = this.gameData.ingame[realPlayer.profile.name] || { ownBets: {} };
        const roundHistory = await this.roundQuery.getList(this.definition.numberOfRoundHistory);

        return {
            roundId,
            gameConfigs,
            roundHistory,
            ownBets,
            totalBets,
            user: { ...user, rate },
            resultHash: this.getResultHash(),
            clientSeed,
        };
    }

    getResultHash() {
        return this.gameData.roundId > this.gameData.resultHash.roundId
            ? { rawValue: this.gameData.resultHash.rawValue, extraInfos: this.gameData.result }
            : { hashValue: this.gameData.resultHash.hashValue };
    }

    async getUserInfo(realPlayer) {
        const resultGetBalance = await this.getBalance(realPlayer);
        const { response } = resultGetBalance;

        let user = {};
        if (resultGetBalance.isOk) {
            user = await getOrDefault(this.gameManagementApiClient.users.setBalance({ id: realPlayer.UID, balance: response.red }), user);
        } else {
            user = await getOrDefault(this.gameManagementApiClient.users.getUserInfo(realPlayer.UID), user);
        }
        return this.formatUserInfo(user);
    }

    formatUserInfo(userInfo) {
        if (userInfo && Object.keys(userInfo).length !== 0) {
            return {
                UID: userInfo.UID,
                name: userInfo.name,
                avatarId: userInfo.avatarId,
                red: userInfo.red,
                scoins: userInfo.scoins,
                currency: userInfo.currency,
                type: userInfo.type,
            };
        }
        return {};
    }
}
