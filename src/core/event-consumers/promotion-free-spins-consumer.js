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
            await this.handlePromotionFreeSpinsExpiry(gameId);
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

    async handlePromotionFreeSpinsExpiry(gameId) {
        const now = moment.utc();

        const runningPromotions = await this.promotionApiClient.getExpiringPromotions(gameId);
        this.logService?.log(`Found total ${runningPromotions.length} promotions`);

        for (const promotion of runningPromotions) {
            this.logService?.log(`Found promotion ${promotion.promotionId} with end date ${this.toYMDHM(promotion.endDate)}`);

            if (this.toYMDHM(now) === this.toYMDHM(new Date(promotion.endDate))) {
                this.promotionFreeSpinsPublisher.publishEndPromotion(promotion.players);
            }
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
            this.promotionFreeSpinsPublisher.publishToUser(player.UID, {
                redeemResult: 1,
                promotion: {
                    promotionId: promotion.promotionId,
                    remainingBonusItems: promotion.remainingBonusItems,
                    initialBonusItem: promotion.initialBonusItem,
                    isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
                    promotionType: promotion.promotionType,
                    endDate: promotion.endDate,
                    lastUsedDate: promotion.lastUsedDate,
                    isGiftCode: promotion.isGiftCode,
                    betLevel: promotion.betLevel,
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
            player.promotion = {
                promotionId: promotion.promotionId,
                code: promotion.promotionCode,
                remainingBonusItems: promotion.remainingBonusItems,
                initialBonusItem: promotion.initialBonusItem,
                isActive: promotion.endDate ? now < new Date(promotion.endDate) : true,
                endDate: promotion.endDate,
                lastUsedDate: promotion.lastUsedDate,
                isGiftCode: promotion.isGiftCode,
                betLevel: promotion.betLevel,
                totalWin: 0,
                isClaimed: true,
            };
        }
    }

    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }
}
