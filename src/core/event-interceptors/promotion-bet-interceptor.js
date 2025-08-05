import { helpers } from "sc-common";
import BaseEventInterceptor from "./base-event-interceptor.js";

/**
 * Promotion Bet Event Interceptor
 * Handles promotion logic using the established game base event interceptor pattern
 * Similar to other EventConsumers but for cross-cutting promotion concerns
 */
export default class PromotionBetInterceptor extends BaseEventInterceptor {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.logService - Logging service
     * @param {Object} dependencies.definition - Game definition
     * @param {Object} dependencies.placeBetPublisher - Publisher for bet events
     * @param {Object} dependencies.gamePromotionApiClient - Promotion API client
     */
    constructor({ logService, definition, placeBetPublisher, gamePromotionApiClient }) {
        super({ logService, definition });
        this.placeBetPublisher = placeBetPublisher;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
    }

    /**
     * Determine if this interceptor should process the bet
     * @param {Object} context - Event context
     * @param {Object} context.payload - Bet payload
     * @returns {boolean} Whether this interceptor should process
     */
    shouldIntercept(context) {
        const { payload } = context;

        return !!(payload && payload.usePromotion && payload.promotionId && this.isPromotionApiAvailable());
    }

    /**
     * Process before bet placement - handle promotion deduction
     * @param {Object} context - Event context
     * @param {Object} context.player - Player object
     * @param {Object} context.payload - Bet payload
     * @returns {Promise<Object>} Result with success status
     */
    async beforeEvent(context) {
        const { player, payload } = context;

        try {
            const promotionData = player.promotion;

            const deductDto = {
                operatorId: player.session.operatorId,
                playerId: player.session.playerId,
                promotionId: promotionData.promotionId,
                siteName: player.session.siteName,
            };

            const deductResult = await this.gamePromotionApiClient.deductBonusItem(deductDto);

            if (!deductResult || !deductResult.success) {
                this.logService.logError(`Failed to deduct bonus item for player ${player.profile.name}:`, deductResult);
                this.placeBetPublisher.publishGameFailedBet(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion deduction failed" },
                });
                return { success: false };
            }

            player.promotion.remainingBonusItems = deductResult.remainingBonusItems || promotionData.remainingBonusItems - 1;

            return { success: true };
        } catch (error) {
            this.logService.logError(`Error processing promotion deduction for player ${player.profile.name}:`, error);
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                betChoice: payload.betChoice,
                notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion processing error" },
            });
            return { success: false };
        }
    }

    /**
     * Process after successful bet placement
     * @param {Object} context - Event context
     * @param {Object} context.player - Player object
     * @param {Object} context.bet - Bet object
     * @param {Date} context.betTime - Bet timestamp
     * @returns {Promise<void>}
     */
    async afterSuccessEvent(context) {
        const { player, bet } = context;

        try {
            const ticketDto = {
                playerId: player.session.playerId,
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                promotionId: player.promotion.promotionId,
                gameId: this.definition.id,
                gameRoundId: bet.roundId,
                appType: player.session.system,
                betAmount: bet.amount,
                winAmount: bet.betWin,
            };

            const ticketResult = await this.gamePromotionApiClient.createPromotionTicket(ticketDto);

            if (!ticketResult || !ticketResult.success) {
                this.logService.logError(`Failed to create promotion ticket for player ${player.profile.name}:`, {
                    error: ticketResult?.error || "Unknown error",
                    promotionId: bet.promotionId,
                    gameRoundId: bet.roundId,
                });
                return;
            }

            if (bet.betWin > 0) {
                player.promotion.totalWin = (player.promotion.totalWin || 0) + bet.betWin;
            }

            this.endPromotionEvent(context);
        } catch (error) {
            this.logService.logError(`Error creating promotion ticket for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
        }
    }

    /**
     * Process after promotion end
     * @param {Object} context - Event context
     * @param {Object} context.player - Player object
     * @returns {Promise<void>}
     */
    async endPromotionEvent(context) {
        const { player } = context;

        try {
            if (!this.shouldCompletePromotion(player)) {
                return;
            }

            await this.notifyPromotionCompletion(player);
            await this.completePromotion(player);
        } catch (error) {
            this.logService.logError(`Error ending promotion for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: player.promotion.promotionId,
                stack: error.stack,
            });
        }
    }

    /**
     * Check if promotion should be completed
     * @param {Object} player - Player object
     * @returns {boolean} Whether promotion should be completed
     */
    shouldCompletePromotion(player) {
        return player.promotion.remainingBonusItems === 0;
    }

    /**
     * Notify user about promotion completion
     * @param {Object} player - Player object
     * @returns {Promise<void>}
     */
    async notifyPromotionCompletion(player) {
        const totalWin = player.promotion.totalWin || 0;

        this.placeBetPublisher.publishToUser(
            player.UID,
            {
                finishPromotion: {
                    endPromotion: true,
                    totalWin: totalWin,
                },
            },
            this.definition.name
        );
    }

    /**
     * Finalize the promotion
     * @param {Object} player - Player object
     * @returns {Promise<void>}
     */
    async completePromotion(player) {
        const completePromotionResult = await this.gamePromotionApiClient.completePromotion({
            promotionId: player.promotion.promotionId,
            playerId: player.session.playerId,
            operatorId: player.session.operatorId,
            currencyGroup: player.session.currencyGroupId,
            siteName: player.session.siteName,
        });

        this.placeBetPublisher.publishToUser(
            player.UID,
            {
                promotionTOProgress: {
                    totalTO: completePromotionResult.totalTurnover,
                    minTO: completePromotionResult.minRequiredTurnover,
                    remainTO: completePromotionResult.remainingTO,
                    progress: completePromotionResult.progressPercentage,
                    canClaim: completePromotionResult.canClaim,
                    win: completePromotionResult.totalWinAmount,
                    expire: completePromotionResult.claimExpirationDate,
                },
            },
            this.definition.name
        );
    }

    /**
     * Process after failed bet placement
     * @param {Object} context - Event context
     * @param {Object} context.player - Player object
     * @param {Object} context.bet - Bet object
     * @returns {Promise<void>}
     */
    async afterFailureEvent(context) {
        const { player, bet } = context;

        try {
            const rollbackDto = {
                operatorId: player.session.operatorId,
                playerId: player.session.playerId,
                promotionId: bet.promotionId,
            };

            const rollbackResult = await this.gamePromotionApiClient.rollbackBonusItem(rollbackDto);

            if (rollbackResult && rollbackResult.success) {
                if (player.promotion && player.promotion.promotionId === bet.promotionId) {
                    player.promotion.remainingBonusItems += 1;
                }
            } else {
                this.logService.logError(`Failed to rollback promotion after failure for player ${player.profile.name}:`, {
                    error: rollbackResult?.error || "Unknown error",
                    promotionId: bet.promotionId,
                });
            }
        } catch (error) {
            this.logService.logError(`Error rolling back promotion after failure for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
        }
    }

    /**
     * Transform event data with promotion metadata
     * @param {string} transformName - Name of the transformation
     * @param {Object} context - Event context
     * @returns {Object} Transformed data
     */
    transformEventData(transformName, context) {
        const { payload, betInfo, betRecord, betLog, bet } = context;

        switch (transformName) {
            case "enhanceBetInfo":
                if (betInfo && payload.promotionId) {
                    betInfo.promotionCode = payload.promotionCode;
                    betInfo.promotionId = payload.promotionId;
                }
                return betInfo;

            case "enhanceBetRecord":
                if (bet?.promotionId) {
                    betRecord.promotionId = bet.promotionId;
                }
                return betRecord;

            case "enhanceBetLog":
                if (bet?.promotionId) {
                    betLog.promotionId = bet.promotionId;
                }
                return betLog;

            default:
                return super.transformEventData(transformName, context);
        }
    }

    /**
     * Check if promotion API client is available
     * @returns {boolean} Whether API client is available
     */
    isPromotionApiAvailable() {
        return this.gamePromotionApiClient !== null && this.gamePromotionApiClient !== undefined;
    }
}
