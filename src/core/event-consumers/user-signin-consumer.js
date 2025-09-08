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
        console.log(`signInGameResult: ${JSON.stringify(signInGameResult)}`);

        const userSession = {
            ...signInGameResult,
            userId: signInGameResult.id,
            playerName: signInGameResult.memberName,
            browserUserAgent: socketClient.request.headers["user-agent"],
        };

        const userInfo = await getOrDefault(this.gameManagementApiClient.users.getUserInfo(userSession.userId));
        console.log(`userInfo: ${JSON.stringify(userInfo)}`);

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
        if (!this.isPromotionAvailable(userSession)) {
            return null;
        }

        const playerData = this.extractPlayerData(userSession);
        if (!this.isValidPlayerData(playerData)) {
            return null;
        }

        try {
            const playerDto = this.createPlayerDto(playerData);

            this.logService.log(`Claiming promotion for player ${JSON.stringify(playerDto)}`);
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
    isPromotionAvailable(userSession) {
        return this.promotionApiClient && this.appConfigs.promotionApiSettings && this.isPromotionAvailableForPlayer(userSession);
    }

    isPromotionAvailableForPlayer(userSession) {
        if (this.gameData.promotions.length === 0) {
            return false;
        }

        const now = new Date();
        const { operatorId, siteName, currencyGroupId, playerId } = userSession;
        const isTimeValid = this.gameData.promotions.filter((promotion) => 
            promotion.startDate <= now && promotion.claimPlayerPromotions >= now
        );
        const isTargetingValid = this.isPromotionTargetingValid(siteName, playerId, currencyGroupId);
        const isGameAndOperatorValid = this.isPromotionAvailableForGame(gameId, operatorId);
        
        return isTimeValid && isTargetingValid && isGameAndOperatorValid;
    }

    isPromotionAvailableForGame(gameId, operatorId) {
        return this.gameData.promotions.filter((promotion) => promotion.gameIds.includes(gameId) 
            && promotion.operatorId === operatorId);
    }

    isPromotionTargetingValid(siteName, playerId, currencyGroupId) {
        const isTargetingSite = this.gameData.promotions.filter((promotion) => 
            promotion.offeredSiteNames.includes(siteName) || promotion.offeredSiteNames.length === 0
        );
        const isTargetingPlayer = this.gameData.promotions.filter((promotion) => 
            promotion.offeredPlayerIds.includes(playerId) || promotion.offeredPlayerIds.length === 0
        );
        const isTargetingCurrencyGroup = this.gameData.promotions.filter((promotion) => 
            promotion.currencyGroups.includes(currencyGroupId) || promotion.currencyGroups.length === 0
        );
        return isTargetingSite && isTargetingPlayer && isTargetingCurrencyGroup;
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
            gameId: this.gameData.gameConfigs.gameId,
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
                siteName: playerDto.siteName,
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
        return this.promotionApiClient.getTotalWin({
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
        const basePromotionData = this.createBasePromoData(promotion, now);
        const promotionData = {
            ...basePromotionData,
            totalWin: totalWin,
            isClaimed: true,
        };

        const extendedPromotionData = this.extendPromo(promotionData, promotion);

        return {
            promotion: extendedPromotionData,
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

    createBasePromoData(promotion, currentTime) {
        return {
            promotionId: promotion.promotionId,
            remainingBonusItems: promotion.remainingBonusItems,
            initialBonusItem: promotion.initialBonusItem,
            isActive: promotion.endDate ? currentTime < new Date(promotion.endDate) : true,
            promotionType: promotion.promotionType,
            endDate: promotion.endDate,
            lastUsedDate: promotion.lastUsedDate,
            isGiftCode: promotion.isGiftCode,
        };
    }

    extendPromo(baseData, originalPromotion) {
        return baseData;
    }

    createAvailablePromotionData(promotion) {
        const now = new Date();
        const basePromotionData = {
            promotionId: promotion._id,
            remainingBonusItems: promotion.bonusItemCount,
            isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
            endDate: promotion.endDate,
            isGiftCode: promotion.isGiftCode,
            isClaimed: false,
        };

        const extendedPromotionData = this.extendPromo(basePromotionData, promotion);

        return {
            promotion: extendedPromotionData,
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
