import moment from "moment";
import { helpers } from "sc-common";

export default class PromotionFreeSpinsConsumer {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.gameData
     * @param {Object} dependencies.promotionFreeSpinsPublisher
     * @param {Object} dependencies.logService
     * @param {Object} [dependencies.gamePromotionApiClient]
     */
    constructor({ gameData, promotionFreeSpinsPublisher, logService, gamePromotionApiClient }) {
        this.gameData = gameData;
        this.promotionFreeSpinsPublisher = promotionFreeSpinsPublisher;
        this.logService = logService;
        this.promotionApiClient = gamePromotionApiClient?.instance();
        this.lastMinuteCheck = new Date().getMinutes();
    }

    toYMDHM = (date) => moment.utc(date).format("YYYY-MM-DDTHH:mm");

    async checkExpiry(gameId) {
        if (!this.isPromotionReady()) {
            return;
        }

        if (!this.hasPlayersWithPromotions()) {
            return;
        }

        const currentMinuteTimestamp = new Date().getMinutes();

        if (this.lastMinuteCheck !== currentMinuteTimestamp) {
            this.logService?.log(
                `Checking promotion expiry for game ${gameId}, lastMinuteCheck: ${this.lastMinuteCheck}, currentMinuteTimestamp: ${currentMinuteTimestamp}`
            );

            this.lastMinuteCheck = currentMinuteTimestamp;
            await this.handlePromotionFreeSpinsExpiry();
        }
    }

    isPromotionReady() {
        return this.gameData.promotionReady === true;
    }

    hasPromotionApiClient() {
        return this.promotionApiClient !== null && this.promotionApiClient !== undefined;
    }

    hasPlayersWithPromotions() {
        const players = this.gameData.realPlayers || {};
        return Object.values(players).some((player) => player.promotion);
    }

    async handlePromotionFreeSpinsExpiry() {
        const now = moment.utc();
        const currentTimeKey = this.toYMDHM(now);

        const expiredPlayers = Object.values(this.gameData.realPlayers || {}).filter((player) => {
            if (!player.promotion?.endDate) return false;
            return currentTimeKey === this.toYMDHM(new Date(player.promotion.endDate));
        });

        if (expiredPlayers.length === 0) {
            return;
        }

        this.logService?.log(`Found ${expiredPlayers.length} players with expired promotions`);

        const expiredPlayerData = expiredPlayers.map((player) => ({
            playerId: player.session.playerId,
            totalWin: player.promotion.totalWin,
        }));

        this.promotionFreeSpinsPublisher.publishEndPromotion(expiredPlayerData);

        expiredPlayers.forEach((player) => {
            delete player.promotion;
            delete player.promotionTOProgress;
        });
    }

    async consume(player, payload) {
        try {
            if (!this.isPromotionReady()) {
                this.publishRedemptionError(player, helpers.noticeHelper.invalidBet, "Promotion system not available");
                return;
            }

            await this.processRedeem(player, payload);
        } catch (error) {
            this.logService?.logError(`Error in promotion consumer for player ${player.profile.name}:`, error);
        }
    }

    publishRedemptionError(player, errorCode, message) {
        this.promotionFreeSpinsPublisher.publishToUser(player.UID, {
            redeemResult: -1,
            redemptionNotice: this.getNoticeObj(errorCode, { message }),
        });
    }

    async processRedeem(player, payload) {
        const result = await this.promotionApiClient.redeemGiftCode({
            giftCode: payload.giftCode,
            operatorId: player.session.operatorId,
            siteName: player.session.siteName,
            playerId: player.session.playerId,
            currencyGroup: player.session.currencyGroupId,
            gameId: this.gameData.gameConfigs.gameId,
        });

        if (result.success) {
            await this.updatePromotion(player, result);
            const promotion = result.promotion;
            const now = new Date();
            const basePromotionData = this.createBasePromoData(promotion, now);
            const extendedPromotionData = this.extendPromo(basePromotionData, promotion);

            this.promotionFreeSpinsPublisher.publishToUser(player.UID, {
                redeemResult: 1,
                promotion: {
                    ...extendedPromotionData,
                    totalWin: 0,
                    isClaimed: true,
                },
            });
        } else {
            this.publishRedemptionError(player, result.code, result.message);
        }
    }

    async updatePromotion(player, result) {
        const promotionFreeSpin = await this.promotionApiClient.getPromotionById(result.promotion.promotionId);
        const now = new Date();
        if (promotionFreeSpin.gameIds.includes(this.gameData.gameConfigs.gameId)) {
            const promotion = result.promotion;
            const basePromotionData = this.createBasePromoData(promotion, now);
            const extendedPromotionData = this.extendPromo(basePromotionData, promotion);

            player.promotion = {
                ...extendedPromotionData,
                code: promotion.promotionCode,
                totalWin: 0,
                isClaimed: true,
            };
        }
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

    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }
}
