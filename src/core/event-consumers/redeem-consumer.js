import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";

/**
 * Configuration interface for RedeemConsumer
 * @typedef {Object} RedeemConfig
 * @property {Object} logService - Logging service
 * @property {PromotionClient} [gamePromotionApiClient] - Optional promotion API client
 */

export default class RedeemConsumer {
    /**
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {RedeemConfig} config - Configuration object
     */
    constructor(gameData, publisher, config) {
        this.gameData = gameData;
        this.publisher = publisher;
        this.logService = config.logService;
        this.promotionApiClient = config.gamePromotionApiClient?.instance();
    }

    /**
     * @param {Object} player - Player object
     * @param {Object} payload - Redeem payload (giftCode)
     */
    async consume(player, payload) {
        try {
            await this.processRedeem(player, payload);
        } catch (error) {
            this.logService?.logError(`Error in redeem consumer for player ${player.profile.name}:`, error);
        }
    }

    /**
     * Hàm gửi lỗi về client, tránh lặp code
     */
    sendRedeemError(player, errorCode, message) {
        this.publisher.publishToUser(player.UID, {
            redeemResult: -1,
            notice: this.getNoticeObj(errorCode, { message }),
        });
    }

    /**
     * @param {Object} player
     * @param {Object} payload
     */
    async processRedeem(player, payload) {
        const result = await this.promotionApiClient.redeemGiftCode({
            giftCode: payload.giftCode,
            operatorId: player.session.operatorId,
            siteName: player.session.siteName,
            playerId: player.session.playerId,
            currencyGroup: player.session.currencyGroupId,
        });

        if(result.success) {
            await this.updatePromotion(player, result);
            this.publisher.publishToUser(player.UID, {
                redeemResult: 1,
                promotion: result.promotion               
            });
        }
        else {
            this.sendRedeemError(player, result.code, result.message);
        }       
    }

    async updatePromotion(player, result) {
        const promotionFreeSpin = await this.promotionApiClient.getPromotionById(result.promotion.promotionId);      
        const now = new Date();
        if(promotionFreeSpin.gameIds.includes(this.gameData.gameConfigs.gameId)) {
            const totalWin = await this.promotionApiClient.getTotalWin({
                promotionId: result.promotion.promotionId,
                playerId: player.session.playerId,
                operatorId: player.session.operatorId
            });
    
            const promotion = result.promotion;
            player.promotion = {
                promotionId: promotion.promotionId,
                code: promotion.promotionCode,
                bonusItemCount: promotion.remainingBonusItems,
                initialBonusItem : promotion.initialBonusItem,
                isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
                promotionType: promotion.promotionType,
                endDate: promotion.endDate,
                lastUsedDate: promotion.lastUsedDate,
                isGiftCode: promotion.isGiftCode,
                betLevel: promotion.betLevel,
                totalWin: totalWin,
                isClaimed: true
            };
        }
    }

    /**
     * Tạo notice object trả về client
     * @param {string} errorCode
     * @param {Object} extraData
     * @returns {Object}
     */
    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }
}
