export default class PromotionAssignmentConsumer {
    constructor({ definition, gamePromotionApiClient, logService, publisher }) {
        this.definition = definition;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
        this.logService = logService;
        this.publisher = publisher;
    }

    /**
     * Clear all promotion-related data from player session
     * @param {Object} player - Player object
     */
    clearPromotionData(player) {
        delete player.promotion;
        delete player.promotionTOProgress;
    }

    /**
     * Fetch next available promotion for player from API
     * @param {Object} player - Player object
     * @returns {Promise<Object|null>} Promotion data or null if none available
     */
    async fetchNextAvailablePromotion(player) {
        try {
            const { session } = player;
            const result = await this.gamePromotionApiClient.checkEligibility({
                playerId: session.playerId,
                currencyGroup: session.currencyGroupId,
                operatorId: session.operatorId,
                siteName: session.siteName,
                gameId: this.definition.id,
            });

            if (!result || !result.promotions || result.promotions.length === 0) {
                return null;
            }

            const firstPromotion = result.promotions.shift();
            const currentTime = new Date();

            return {
                promotionId: firstPromotion._id,
                remainingBonusItems: firstPromotion.bonusItemCount,
                isActive: firstPromotion.endDate ? currentTime < new Date(firstPromotion.endDate) : false,
                endDate: firstPromotion.endDate,
                isGiftCode: firstPromotion.isGiftCode,
                isClaimed: false,
            };
        } catch (error) {
            this.logService.logError(`Error fetching next available promotion for player ${player.session.playerId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Assign next available promotion to player and publish to client
     * @param {Object} player - Player object
     * @param {Object} options - Options
     * @param {boolean} options.clearExisting - Whether to clear existing promotion data first (default: false)
     * @param {boolean} options.publishToClient - Whether to publish to client (default: true)
     * @returns {Promise<Object|null>} Assigned promotion data or null
     */
    async assignNextPromotion(player, { clearExisting = false, publishToClient = true } = {}) {
        try {
            if (clearExisting) {
                this.clearPromotionData(player);
            }
            const promotionData = await this.fetchNextAvailablePromotion(player);

            if (promotionData) {
                player.promotion = promotionData;
                if (publishToClient) {
                    this.publisher.publishToUser(player.UID, { promotion: promotionData });
                }

                this.logService.log(`Assigned promotion ${promotionData.promotionId} to player ${player.session.playerId}`);
                return promotionData;
            } else {
                player.promotion = null;

                this.logService.log(`No promotion available for player ${player.session.playerId}`);
                return null;
            }
        } catch (error) {
            this.logService.logError(`Error assigning promotion to player ${player.session.playerId}: ${error.message}`);
            player.promotion = null;
            return null;
        }
    }
}
