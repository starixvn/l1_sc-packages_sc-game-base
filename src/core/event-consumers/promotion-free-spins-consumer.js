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

        if (!this.isCheckPromotionExpiry()) {
            return;
        }

        const currentMinuteTimestamp = new Date().getMinutes();

        if (this.lastMinuteCheck !== currentMinuteTimestamp) {
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

    hasPlayerWithPromotion(player) {
        return (
            player.promotion &&
            ((!this.isPromotionCompleted(player) && player.promotion.isClaimed && player.promotion.endDate) ||
                this.isExpiringPromotion(player))
        );
    }

    isPromotionCompleted(player) {
        return player.promotion.remainingBonusItems === 0;
    }

    isCheckPromotionExpiry() {
        const players = this.gameData.realPlayers || {};
        return Object.values(players).some((player) => this.hasPlayerWithPromotion(player));
    }

    isExpiringPromotion(player) {
        return this.gameData.expiringPromotions.some((expiringPromotion) => expiringPromotion._id === player.promotion.promotionId);
    }

    async handlePromotionFreeSpinsExpiry() {
        const expiredPlayers = this.getExpiredPlayers();

        if (expiredPlayers.length === 0) {
            return;
        }

        this.logService?.log(`Found ${expiredPlayers.length} players with expired promotions`);

        const { endedPlayers, expiredPlayersWithTO } = this.categorizeExpiredPlayers(expiredPlayers);
        
        this.publishExpiredPromotionEvents(endedPlayers, expiredPlayersWithTO);
        this.cleanupPlayersPromotionData(expiredPlayers);
    }

    getExpiredPlayers() {
        const now = moment.utc();
        const currentTimeKey = this.toYMDHM(now);

        return Object.values(this.gameData.realPlayers || {}).filter((player) => {
            if (!this.hasPlayerWithPromotion(player)) {
                return false;
            }

            return currentTimeKey === this.toYMDHM(new Date(player.promotion.endDate)) || this.isExpiringPromotion(player);
        });
    }

    categorizeExpiredPlayers(expiredPlayers) {
        const endedPlayers = [];
        const expiredPlayersWithTO = [];

        expiredPlayers.forEach((player) => {
            const playerData = {
                playerId: player.session.playerId,
                totalWin: player.promotion.totalWin,
            };

            if (player.promotionTOProgress) {
                expiredPlayersWithTO.push(playerData);
            } else {
                endedPlayers.push(playerData);
            }
        });

        return { endedPlayers, expiredPlayersWithTO };
    }

    cleanupPlayersPromotionData(players) {
        players.forEach((player) => {
            delete player.promotion;
            delete player.promotionTOProgress;
        });
    }

    publishExpiredPromotionEvents(endedPlayers, expiredPlayersWithTO) {
        if (endedPlayers.length > 0) {
            this.promotionFreeSpinsPublisher.publishEndPromotion(endedPlayers);
        }
        if (expiredPlayersWithTO.length > 0) {
            this.promotionFreeSpinsPublisher.publishExpiredPromotion(expiredPlayersWithTO);
        }
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

    async loadPromotionsRunning() {
        try {
            const runningPromotions = await this.promotionApiClient.getAllPromotionsRunning(this.gameData.gameConfigs.gameId);
            this.gameData.expiringPromotions = (this.gameData.promotions || []).filter(
                (promo) => !runningPromotions.some((runningPromotion) => runningPromotion._id === promo._id)
            );
            this.gameData.promotions = runningPromotions;
            await this.handlePromotionFreeSpinsExpiry();
        } catch (error) {
            this.logService?.logError(
                `Failed to get all promotions running for ${this.gameData.gameConfigs.gameId}: ${JSON.stringify(error)}`
            );
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
