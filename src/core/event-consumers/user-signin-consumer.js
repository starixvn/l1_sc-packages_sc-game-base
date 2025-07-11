import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import GameManagementApiClientFactory, { getOrDefault, callAndForget } from "../game-management-api";
import { PromotionClient } from "../promotion-client";
import { signInGame as userServiceSignInGame } from "../helpers/user-service-helpers";
import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

export default class UserSignInConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {UserSignInPublisher} dependencies.userSignInPublisher
     * @param {PlayGamePermissionValidator} dependencies.playGamePermissionValidator
     * @param {Object} dependencies.appConfigs
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {Object} dependencies.logService
     * @param {PromotionClient} [dependencies.gamePromotionApiClient]
     */
    constructor({
        gameData,
        userSignInPublisher,
        playGamePermissionValidator,
        appConfigs,
        gameManagementApiClientFactory,
        logService,
        gamePromotionApiClient,
    }) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.playGamePermissionValidator = playGamePermissionValidator;
        this.appConfigs = appConfigs;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
        this.logService = logService;
        this.promotionApiClient = gamePromotionApiClient?.instance();
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
        if (!this.isPromotionAvailable()) {
            return null;
        }

        const playerData = this.extractPlayerData(userSession);
        if (!this.isValidPlayerData(playerData)) {
            return null;
        }

        try {
            const playerDto = this.createPlayerDto(playerData);

            // Try to claim existing promotion
            const claimedPromotion = await this.tryClaimExistingPromotion(playerDto);
            if (claimedPromotion) {
                return claimedPromotion;
            }

            // Check for available promotions
            return await this.checkAvailablePromotions(playerDto);
        } catch (error) {
            this.logService.logError(`Failed to claim promotion for player ${playerData.playerId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if promotion API is available
     * @returns {boolean}
     */
    isPromotionAvailable() {
        return this.promotionApiClient && this.appConfigs.promotionApiSettings;
    }

    /**
     * Extract player data from user session
     * @param {Object} userSession - User session data
     * @returns {Object} Player data object
     */
    extractPlayerData(userSession) {
        const { operatorId, siteName, currencyGroupId, playerId } = userSession;
        return { operatorId, siteName, currencyGroupId, playerId };
    }

    /**
     * Validate if player data contains all required fields
     * @param {Object} playerData - Player data object
     * @returns {boolean}
     */
    isValidPlayerData(playerData) {
        const { operatorId, siteName, currencyGroupId, playerId } = playerData;
        return operatorId && siteName && currencyGroupId && playerId;
    }

    /**
     * Create player DTO for API calls
     * @param {Object} playerData - Player data object
     * @returns {Object} Player DTO
     */
    createPlayerDto(playerData) {
        const { operatorId, siteName, playerId, currencyGroupId } = playerData;
        return {
            operatorId,
            siteName,
            playerId,
            currencyGroup: currencyGroupId,
        };
    }

    /**
     * Try to claim an existing promotion
     * @param {Object} playerDto - Player DTO
     * @returns {Promise<Object|null>} Claimed promotion data or null
     */
    async tryClaimExistingPromotion(playerDto) {
        const result = await this.promotionApiClient.claimPromotion(playerDto);

        if (!result?.promotion) {
            return null;
        }

        const promotion = result.promotion;
        const promotionDetails = await this.promotionApiClient.getPromotionById(promotion.promotionId);

        if (!this.isPromotionValidForGame(promotionDetails)) {
            return null;
        }

        const totalWin = await this.getPromotionTotalWin(promotion, playerDto);
        let promotionTOProgress = null;
        
        if (promotion.isCompleted) {
            promotionTOProgress = await this.promotionApiClient.getTOProgress({
                promotionId: promotion.promotionId,
                playerId: playerDto.playerId,
                operatorId: playerDto.operatorId,
                siteName: playerDto.siteName
            });
        }
        
        return this.createClaimedPromotionData(promotion, totalWin, promotionTOProgress);
    }

    /**
     * Check if promotion is valid for current game
     * @param {Object} promotionDetails - Promotion details
     * @returns {boolean}
     */
    isPromotionValidForGame(promotionDetails) {
        return promotionDetails?.gameIds?.includes(this.gameData.gameConfigs.gameId);
    }

    /**
     * Get total win for a promotion
     * @param {Object} promotion - Promotion object
     * @param {Object} playerDto - Player DTO
     * @returns {Promise<number>} Total win amount
     */
    async getPromotionTotalWin(promotion, playerDto) {
        return await this.promotionApiClient.getTotalWin({
            promotionId: promotion.promotionId,
            playerId: playerDto.playerId,
            operatorId: playerDto.operatorId,
            siteName: playerDto.siteName,
        });
    }

    /**
     * Create claimed promotion data object
     * @param {Object} promotion - Promotion object
     * @param {number} totalWin - Total win amount
     * @param {Object|null} promotionTOProgress - Promotion TO progress data
     * @returns {Object} Claimed promotion data
     */
    createClaimedPromotionData(promotion, totalWin, promotionTOProgress = null) {
        const now = new Date();
        const promotionData = {
            promotionId: promotion.promotionId,
            remainingBonusItems: promotion.remainingBonusItems,
            initialBonusItem: promotion.initialBonusItem,
            isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
            promotionType: promotion.promotionType,
            endDate: promotion.endDate,
            lastUsedDate: promotion.lastUsedDate,
            isGiftCode: promotion.isGiftCode,
            betLevel: promotion.betLevel,
            totalWin: totalWin,
            isClaimed: true,
        };

        return {
            promotion: promotionData,
            ...(promotionTOProgress && { promotionTOProgress }),
        };
    }

    /**
     * Check for available promotions
     * @param {Object} playerDto - Player DTO
     * @returns {Promise<Object|null>} Available promotion data or null
     */
    async checkAvailablePromotions(playerDto) {
        const hasPromotion = await this.promotionApiClient.checkEligibility(playerDto);

        if (!hasPromotion?.promotions?.length) {
            return null;
        }

        const validPromotion = hasPromotion.promotions.find((promotion) => promotion.gameIds?.includes(this.gameData.gameConfigs.gameId));

        if (!validPromotion) {
            return null;
        }

        return this.createAvailablePromotionData(validPromotion);
    }

    /**
     * Create available promotion data object
     * @param {Object} promotion - Promotion object
     * @returns {Object} Available promotion data
     */
    createAvailablePromotionData(promotion) {
        const now = new Date();
        return {
            promotion: {
                promotionId: promotion._id,
                remainingBonusItems: promotion.bonusItemCount,
                isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
                endDate: promotion.endDate,
                isGiftCode: promotion.isGiftCode,
                betLevel: promotion.betLevel,
                isClaimed: false,
            },
        };
    }

    handleSignInSuccess(socketClient, userInfo, userSession, promotionData = null) {
        const userData = {
            UID: userSession.userId,
            profile: { name: userInfo.name, minBet: userInfo.minBet, maxBet: userInfo.maxBet },
            session: userSession,
            socketClient,
        };

        if (promotionData && promotionData.promotion) {
            userData.promotion = promotionData.promotion;
        }

        if (promotionData && promotionData.promotionTOProgress) {
            userData.promotionTOProgress = promotionData.promotionTOProgress;
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
