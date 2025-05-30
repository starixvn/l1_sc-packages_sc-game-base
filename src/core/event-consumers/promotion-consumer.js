import { helpers } from "sc-common";

export default class PromotionConsumer {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logService
     * @param {Object} dependencies.gamePromotionApiClientFactory
     * @param {Object} dependencies.placeBetPublisher
     * @param {Object} dependencies.definition
     */
    constructor({ logService, gamePromotionApiClientFactory, placeBetPublisher, definition }) {
        this.logService = logService;
        this.gamePromotionApiClient = gamePromotionApiClientFactory?.instance();
        this.placeBetPublisher = placeBetPublisher;
        this.definition = definition;
    }

    /**
     * Process promotion deduction via API
     * @param {Object} player - Player object
     * @param {Object} payload - Bet payload
     * @returns {Promise<Object>} Result with success status
     */
    async processPromotionDeduction(player, payload) {
        if (!this.gamePromotionApiClient) {
            this.logService?.logError(`Promotion API client not available for deduction - player: ${player.profile.name}`);
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                betChoice: payload.betChoice,
                notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion service unavailable" },
            });
            return { success: false };
        }

        try {
            const promotionData = player.promotion;

            const deductDto = {
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                playerId: player.session.playerId,
                promotionId: promotionData.promotionId,
                quantity: 1,
            };

            const deductResult = await this.gamePromotionApiClient.deductBonusItem(deductDto);

            if (!deductResult || !deductResult.success) {
                this.logService?.logError(`Failed to deduct bonus item for player ${player.profile.name}:`, deductResult);
                this.placeBetPublisher.publishGameFailedBet(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion deduction failed" },
                });
                return { success: false };
            }

            // Update player's promotion data
            player.promotion.bonusItemCount = deductResult.remainingBonusItems || promotionData.bonusItemCount - 1;

            this.logService?.logInfo(`Successfully deducted bonus item for player ${player.profile.name}`, {
                promotionId: promotionData.promotionId,
                remainingBonusItems: player.promotion.bonusItemCount,
            });

            return { success: true };
        } catch (error) {
            this.logService?.logError(`Error processing promotion deduction for player ${player.profile.name}:`, error);
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                betChoice: payload.betChoice,
                notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion processing error" },
            });
            return { success: false };
        }
    }

    /**
     * Create promotion ticket for promotion bets
     * @param {Object} player - Player object
     * @param {Object} bet - Bet object
     * @param {Date} betTime - Bet timestamp
     * @returns {Promise<boolean>} Success status
     */
    async createPromotionTicket(player, bet, betTime) {
        if (!this.gamePromotionApiClient) {
            this.logService?.logInfo(`Promotion API client not available for ticket creation - player: ${player.profile.name}`);
            return false;
        }

        try {
            const ticketDto = {
                playerId: player.session.playerId,
                operatorId: player.session.operatorId,
                gameId: this.definition.id,
                gameRoundId: bet.roundId,
                appType: 1, // Default app type - can be configured if needed
                betAmount: bet.amount,
                winAmount: 0, // Will be updated when game settles
            };

            const ticketResult = await this.gamePromotionApiClient.createPromotionTicket(ticketDto);

            if (!ticketResult || !ticketResult.success) {
                this.logService?.logError(`Failed to create promotion ticket for player ${player.profile.name}:`, {
                    error: ticketResult?.error || "Unknown error",
                    promotionId: bet.promotionId,
                    gameRoundId: bet.roundId,
                });
                return false;
            }

            this.logService?.logInfo(`Successfully created promotion ticket for player ${player.profile.name}`, {
                promotionId: bet.promotionId,
                gameRoundId: bet.roundId,
                ticketId: ticketResult.ticketId,
            });

            return true;
        } catch (error) {
            this.logService?.logError(`Error creating promotion ticket for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
            return false;
        }
    }

    /**
     * Rollback promotion bonus item when bet fails at API level
     * @param {Object} player - Player object
     * @param {Object} bet - Bet object
     * @returns {Promise<boolean>} Success status
     */
    async rollbackPromotionOnFailure(player, bet) {
        if (!this.gamePromotionApiClient) {
            this.logService?.logWarning(`Promotion API client not available for rollback - player: ${player.profile.name}`);
            return false;
        }

        try {
            const rollbackDto = {
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                playerId: player.session.playerId,
                promotionId: bet.promotionId,
                quantity: 1,
            };

            const rollbackResult = await this.gamePromotionApiClient.rollbackBonusItem(rollbackDto);

            if (rollbackResult && rollbackResult.success) {
                // Update player's promotion data
                if (player.promotion && player.promotion.promotionId === bet.promotionId) {
                    player.promotion.bonusItemCount = rollbackResult.remainingBonusItems || player.promotion.bonusItemCount + 1;
                }

                this.logService?.logInfo(`Successfully rolled back promotion after API failure for player ${player.profile.name}`, {
                    promotionId: bet.promotionId,
                    remainingBonusItems: rollbackResult.remainingBonusItems,
                });

                return true;
            } else {
                this.logService?.logError(`Failed to rollback promotion after API failure for player ${player.profile.name}:`, {
                    error: rollbackResult?.error || "Unknown error",
                    promotionId: bet.promotionId,
                });
                return false;
            }
        } catch (error) {
            this.logService?.logError(`Error rolling back promotion after API failure for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
            return false;
        }
    }

    /**
     * Add promotion metadata to bet info
     * @param {Object} betInfo - Bet info object to enhance
     * @param {Object} payload - Bet payload
     * @returns {Object} Enhanced bet info
     */
    addPromotionMetadata(betInfo, payload) {
        if (payload.usePromotion && payload.promotionId) {
            betInfo.metadata = betInfo.metadata || {};
            betInfo.metadata.usePromotion = true;
            betInfo.metadata.promotionId = payload.promotionId;
        }
        return betInfo;
    }

    /**
     * Add promotion metadata to bet record
     * @param {Object} betRecord - Bet record object to enhance
     * @param {Object} bet - Bet object
     * @returns {Object} Enhanced bet record
     */
    addPromotionMetadataToBet(betRecord, bet) {
        if (bet.usePromotion && bet.promotionId) {
            betRecord.usePromotion = true;
            betRecord.promotionId = bet.promotionId;
        }
        return betRecord;
    }

    /**
     * Add promotion metadata to bet log
     * @param {Object} betLog - Bet log object to enhance
     * @param {Object} bet - Bet object
     * @returns {Object} Enhanced bet log
     */
    addPromotionMetadataToBetLog(betLog, bet) {
        if (bet.usePromotion && bet.promotionId) {
            betLog.usePromotion = true;
            betLog.promotionId = bet.promotionId;
        }
        return betLog;
    }

    /**
     * Check if a bet is a promotion bet
     * @param {Object} payload - Bet payload
     * @returns {boolean} True if it's a promotion bet
     */
    isPromotionBet(payload) {
        return !!(payload.usePromotion && payload.promotionId);
    }

    /**
     * Check if promotion API client is available
     * @returns {boolean} True if API client is available
     */
    isPromotionApiAvailable() {
        return !!this.gamePromotionApiClient;
    }
}
