import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import GameManagementApiClientFactory, { getOrDefault, callAndForget } from "../game-management-api";
import { PromotionClient } from "../promotion-client";
import { signInGame as userServiceSignInGame } from "../helpers/user-service-helpers";
import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

/**
 * Configuration interface for UserSignInConsumer
 * @typedef {Object} UserSignInConfig
 * @property {PlayGamePermissionValidator} playGamePermissionValidator - Permission validator instance
 * @property {Object} appConfigs - Application configurations
 * @property {GameManagementApiClientFactory} gameManagementApiClientFactory - Game management API client factory
 * @property {Object} logService - Logging service
 * @property {PromotionClient} [gamePromotionApiClient] - Optional promotion API client
 */

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {UserSignInConfig} config - Configuration object
     */
    constructor(
        gameData,
        userSignInPublisher,
        config
    ) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.playGamePermissionValidator = config.playGamePermissionValidator;
        this.appConfigs = config.appConfigs;
        this.gameManagementApiClient = config.gameManagementApiClientFactory.instance();
        this.logService = config.logService;
        this.promotionApiClient = config.gamePromotionApiClient?.instance();
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (!payload) {
            this.handleUnauthorizedSignIn(socketClient);
            return;
        }

        const params = {
            session: payload.ss,
            username: payload.username,
            browserUserAgent: socketClient.request.headers["user-agent"],
        };

        const signInGameResult = await userServiceSignInGame(this.appConfigs.userServiceSettings.url, params);

        const userSession = {
            ...signInGameResult,
            userId: signInGameResult.id,
            playerName: signInGameResult.memberName,
        };

        const userInfo = await getOrDefault(this.gameManagementApiClient.users.getUserInfo(userSession.userId));

        if (!userInfo) {
            this.handleUnauthorizedSignIn(socketClient);
            return;
        }

        if (this.playGamePermissionValidator.validate(userSession, socketClient)) {
            await this.getUserBetLimit(userSession, userInfo, socketClient);

            Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                    realPlayer.socketClient.disconnect(true);
                    delete this.gameData.realPlayers[realPlayer.socketClient.id];
                }
            });

            // Claim promotions during sign-in if promotion is available
            const promotionData = await this.claimPlayerPromotions(userSession);

            this.handleSignInSuccess(socketClient, userInfo, userSession, promotionData);
        }
    }

    async getUserBetLimit(userSession, userInfo, socketClient) {
        const apiResult = await getBetLimit({ session: userSession });

        if (apiResult.isOk) {
            const { response } = apiResult;
            if (response.minBet > 0 && response.maxBet > 0) {
                userInfo.minBet = response.minBet;
                userInfo.maxBet = response.maxBet;
                callAndForget(
                    this.gameManagementApiClient.users.updateUserStakeLevel({
                        id: userSession.userId,
                        minBet: response.minBet,
                        maxBet: response.maxBet,
                    })
                );
            }

            const userStakeLevel = { minBet: userInfo.minBet, maxBet: userInfo.maxBet };
            socketClient.emit("message", { userStakeLevel });
        }
    }

    /**
     * Claim promotions for the player during sign-in
     * @param {Object} userSession - User session data
     * @returns {Promise<Object|null>} Promotion data or null
     */
    async claimPlayerPromotions(userSession) {
        // Check if game offers promotion (factory and client must be available)
        if (!this.promotionApiClient || !this.appConfigs.promotionApiSettings) {
            return null;
        }

        // Get player-specific data (these should come from user session or player data)
        const { operatorId, siteName, currencyGroupId, playerId } = userSession;

        // Validate required player data
        if (!operatorId || !siteName || !currencyGroupId || !playerId) {
            return null;
        }

        try {
            const playerDto = {
                operatorId,
                siteName,
                playerId,
                currencyGroup: currencyGroupId,
            };

            const result = await this.promotionApiClient.claimPromotion(playerDto);

            if (!result || !result.promotion) {
                return null;
            }

            const promotionFreeSpin = await this.promotionApiClient.getPromotionById(result.promotion.promotionId);            
            if(!promotionFreeSpin.gameIds.includes(this.gameData.gameConfigs.gameId)) {
                return null;
            }

            const totalWin = await this.promotionApiClient.getTotalWin({
                promotionId: result.promotion.promotionId,
                playerId,
                operatorId
            });

            const promotion = result.promotion;
            const now = new Date();
            // get promotion endDate
            return {
                promotionId: promotion.promotionId,
                code: promotion.promotionCode,
                bonusItemCount: promotion.remainingBonusItems,
                isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
                promotionType: promotion.promotionType,
                endDate: promotion.endDate,
                lastUsedDate: promotion.lastUsedDate,
                isGiftCode: promotion.isGiftCode,
                betLevel: promotion.betLevel,
                totalWin: totalWin,
            };
        } catch (error) {
            this.logService.logError(`Failed to claim promotion for player ${playerId}: ${error.message}`);
            return null;
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession, promotionData = null) {
        const userData = {
            UID: userSession.userId,
            profile: { name: userInfo.name, minBet: userInfo.minBet, maxBet: userInfo.maxBet },
            session: userSession,
            socketClient,
        };

        if (promotionData) {
            userData.promotion = promotionData;
        }

        userSession.characterName = userInfo.name;
        this.gameData.realPlayers[socketClient.id] = userData;

        // Simple sign-in response without promotion data
        socketClient.emit("signedIn");
    }

    handleUnauthorizedSignIn(socketClient) {
        this.userSignInPublisher.publishUnauthorizedMessage(socketClient);
        socketClient.disconnect(true);
    }
}
