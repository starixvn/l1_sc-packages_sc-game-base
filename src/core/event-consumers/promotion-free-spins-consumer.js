import moment from "moment";

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

        const currentSecond = new Date().getSeconds();
        const currentMinuteTimestamp = new Date().getMinutes();

        if (currentSecond === 0 || this.lastMinuteCheck !== currentMinuteTimestamp) {
            this.lastMinuteCheck = currentMinuteTimestamp;
            await this.handlePromotionFreeSpinsExpiry(gameId);
        }
    }

    isPromotionReady() {
        return this.promotionApiClient !== null && this.promotionApiClient !== undefined;
    }

    hasPlayersWithPromotions() {
        const players = this.gameData.ingame || {};
        return Object.values(players).some((player) => player.promotion);
    }

    async handlePromotionFreeSpinsExpiry(gameId) {
        const now = moment.utc();
        const runningPromotions = await this.promotionApiClient.getExpiringPromotions(gameId);

        for (const promotion of runningPromotions) {
            if (this.toYMDHM(now) === this.toYMDHM(new Date(promotion.endDate))) {
                this.promotionFreeSpinsPublisher.publishEndPromotion(promotion.players);
            }
        }
    }
}
