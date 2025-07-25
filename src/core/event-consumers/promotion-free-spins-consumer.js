import moment from "moment";
export default class PromotionFreeSpinsConsumer {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.gameData
     * @param {Object} dependencies.promotionFreeSpinsPublisher
     * @param {Object} dependencies.logService
     * @param {Object} [dependencies.gamePromotionApiClient]
     */
    constructor({
        gameData,
        promotionFreeSpinsPublisher,
        logService,
        gamePromotionApiClient,
    }) {
        this.gameData = gameData;
        this.promotionFreeSpinsPublisher = promotionFreeSpinsPublisher;
        this.logService = logService;
        this.promotionApiClient = gamePromotionApiClient?.instance();
    }

    toYMDHM = (date) => moment.utc(date).format("YYYY-MM-DDTHH:mm");

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