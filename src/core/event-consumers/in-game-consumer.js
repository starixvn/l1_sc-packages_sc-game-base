import GameManagementApiClientFactory, { getOrDefault } from "../game-management-api";
import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { RoundQuery } from "./../query-apis";
import UserTrackingClient from "../communicators/user-tracking-client";

export default class InGameConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {RoundQuery} roundQuery
     * @param {BaseEventPublisher} publisher
     * @param {*} getBalance
     * @param {GameManagementApiClientFactory} gameManagementApiClientFactory
     * @param {UserTrackingClient} userTrackingClient
     */
    constructor(definition, gameData, roundQuery, publisher, getBalance, gameManagementApiClientFactory, userTrackingClient) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery;
        this.publisher = publisher;
        this.getBalance = getBalance;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
        this.userTrackingClient = userTrackingClient;
    }

    async consume(realPlayer) {
        const { remainingTime, gameConfigs } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled || this.gameData.delayStartTime > 0;

        realPlayer.socketClient.emit(this.definition.name, { remainingTime, um: disabled, um_message: this.gameData.umMessages });

        const payload = await this.buildPayload(realPlayer);

        this.publisher.publishToUser(realPlayer.UID, payload);

        await this.trackUserSignIn(realPlayer, payload.user);
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

        const payload = {
            roundId,
            gameConfigs,
            roundHistory,
            ownBets,
            totalBets,
            user: { ...user, rate },
            resultHash: this.getResultHash(),
            clientSeed,
        };

        if (realPlayer.promotion && !realPlayer.promotionTOProgress) {
            payload.promotion = realPlayer.promotion;
        }

        if(realPlayer.promotionTOProgress) {
            payload.promotionTOProgress = {
                totalTO: realPlayer.promotionTOProgress.totalTurnover,
                minTO: realPlayer.promotionTOProgress.minRequiredTurnover,
                remainTO: realPlayer.promotionTOProgress.remainingTO,
                progress: realPlayer.promotionTOProgress.progressPercentage,
                canClaim: realPlayer.promotionTOProgress.canClaim,
                win: realPlayer.promotionTOProgress.totalWinAmount,
                expire: realPlayer.promotionTOProgress.claimExpirationDate,
                promotionId: realPlayer.promotion.promotionId,
            }
        }

        return payload;
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

    async trackUserSignIn(realPlayer, user) {
        const { session } = realPlayer;

        const sessionData = {
            ...session,
            gameId: this.gameData.gameConfigs?.gameId ?? 0,
            gameConfigType: this.gameData.gameConfigs?.type ?? 0,
            balance: user.red,
        };

        try {
            await this.userTrackingClient.signIn(sessionData);
        } catch (error) {
            console.error("Failed to track user game session:", error);
            console.log(sessionData);
        }
    }
}
