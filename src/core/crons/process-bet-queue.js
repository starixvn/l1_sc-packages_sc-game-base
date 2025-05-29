import mongoose from "mongoose";
import { helpers } from "sc-common";
import { tracer } from "sc-instrument";

import BaseMetrics from "../base-metrics";
import GameManagementApiClientFactory, { getOrDefault, callAndForget } from "../game-management-api";
import { PlaceBetPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {PlaceBetPublisher} dependencies.placeBetPublisher
     * @param {*} dependencies.placeBet
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {BaseMetrics} dependencies.baseMetrics
     * @param {Object} dependencies.gamePromotionApiClientFactory - Optional: GamePromotionApiClientFactory
     */
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        gameManagementApiClientFactory,
        baseMetrics,
        provablyFairConsumer,
        gamePromotionApiClientFactory = null,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.placeBet = placeBet;
        this.logService = logService;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.baseMetrics = baseMetrics;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
        this.provablyFairConsumer = provablyFairConsumer;
        this.gamePromotionApiClientFactory = gamePromotionApiClientFactory;
        this.gamePromotionApiClient = gamePromotionApiClientFactory?.instance();
    }

    start() {
        const keepDequeuingBets = () => {
            this.dequeueBets();
            setTimeout(keepDequeuingBets, this.processTimeOut);
        };

        setTimeout(keepDequeuingBets, this.processTimeOut);
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const self = this;
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;

                    tracer.startActiveSpan("dequeueBet", async (span) => {
                        self.proceedBet(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(self.logService.logError)
                            .finally(() => span.end());
                    });
                }
            });
        }
    }

    async proceedBet(player, payload) {
        const betInfo = this.formatApiBetInfo(payload);

        if (!(await this.validateBetRequest(player, payload))) {
            return;
        }

        // Handle promotion deduction before placing bet
        if (payload.usePromotion && this.gamePromotionApiClient) {
            const deductionResult = await this.processPromotionDeduction(player, payload);
            if (!deductionResult.success) {
                return; // Error already handled in processPromotionDeduction
            }
        }

        const apiResult = await this.placeBet({ id: player.UID, session: player.session }, betInfo);
        const { response } = apiResult;

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, response, betInfo.gameRoundId, payload);
        } else {
            this.handleFailedBet(player, response, payload);

            if (
                (player.profile.minBet !== response.apiError?.minBet || player.profile.maxBet !== response.apiError?.maxBet) &&
                response.apiError?.minBet > 0 &&
                response.apiError?.maxBet > 0
            ) {
                this.updateUserStakeLevel(player, response.apiError.minBet, response.apiError.maxBet);
            }
        }

        const totalProcessedTime = (new Date() - payload.receivedTime) / 1000;
        this.baseMetrics.collectBetProcessedTime(totalProcessedTime);
    }

    async validateBetRequest(player, payload) {
        const criteria = await this.composeValidationCriteria(player, payload);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.handleFailedBet(player, failedCriterion.notice, payload);

            return false;
        }

        return true;
    }

    async composeValidationCriteria(player, payload) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(payload.roundId) ?? [];

        return bettingTimeValidationCriteria;
    }

    composeBettingTimeValidationCriteria(roundId) {
        return [
            {
                failure: roundId !== this.gameData.roundId,
                notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
            },
            {
                failure:
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
            },
        ];
    }

    updateUserStakeLevel(player, minBet, maxBet) {
        callAndForget(
            this.gameManagementApiClient.users.updateUserStakeLevel({
                id: player.UID,
                minBet,
                maxBet,
            })
        );

        player.profile.minBet = minBet;
        player.profile.maxBet = maxBet;

        const userStakeLevel = { minBet, maxBet };
        this.placeBetPublisher.publishToUser(player.UID, { userStakeLevel }, this.definition.name);
    }

    formatApiBetInfo(payload) {
        const betInfo = {
            amount: payload.amount,
            gameId: this.definition.id,
            gameRoundId: payload.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            clientSentTime: payload.time ?? new Date(),
            metadata: {
                mode: `${payload.mode}`,
            },
        };

        // Add promotion metadata if applicable
        if (payload.usePromotion && payload.promotionId) {
            betInfo.metadata.usePromotion = true;
            betInfo.metadata.promotionId = payload.promotionId;
        }

        return betInfo;
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        if (this.betLogsRepository) {
            await this.insertBetLog(player, roundId, bet, rate);
        }

        const betTime = await this.upsertBet(player, roundId, bet, rate);

        if (this.isCountOnTotalBets(player)) {
            this.adjustTotalBets(player, bet, rate);
        }

        this.adjustOwnBets(player.profile.name, bet);

        // Handle promotion ticket creation
        if (bet.usePromotion && bet.promotionId) {
            await this.createPromotionTicket(player, bet, betTime);
        }

        callAndForget(
            this.gameManagementApiClient.users.setBalanceAndDecreaseScoins({
                id: player.UID,
                balance: balance.red,
                deductionscoins: 0,
            })
        );
        this.notifyPlacingBetResult(player, balance, bet, rate);

        if (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet) {
            this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    /**
     * Create promotion ticket for promotion bets
     * @param {Object} player - Player object
     * @param {Object} bet - Bet object
     * @param {Date} betTime - Bet timestamp
     */
    async createPromotionTicket(player, bet, betTime) {
        if (!this.gamePromotionApiClient) {
            this.logService?.logInfo(`Promotion API client not available for ticket creation - player: ${player.profile.name}`);
            return;
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
                    betId: ticketDto.betId,
                });
            }
        } catch (error) {
            this.logService?.logError(`Error creating promotion ticket for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
        }
    }

    handleFailedBet(player, notice, bet) {
        const { betChoice } = bet;
        this.decreaseBetTracks(player.profile.name, bet);

        // Handle promotion rollback if bet failed after deduction
        if (bet.usePromotion && bet.promotionId) {
            this.rollbackPromotionOnFailure(player, bet);
        }

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    /**
     * Rollback promotion bonus item when bet fails at API level
     * @param {Object} player - Player object
     * @param {Object} bet - Bet object
     */
    async rollbackPromotionOnFailure(player, bet) {
        if (!this.gamePromotionApiClient) {
            return;
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
                if (player.promotion && player.promotion.promotionId === bet.promotionId) {
                    player.promotion.bonusItemCount = rollbackResult.remainingBonusItems || player.promotion.bonusItemCount + 1;
                }

                this.logService?.logInfo(`Successfully rolled back promotion after API failure for player ${player.profile.name}`, {
                    promotionId: bet.promotionId,
                    remainingBonusItems: rollbackResult.remainingBonusItems,
                });
            } else {
                this.logService?.logError(`Failed to rollback promotion after API failure for player ${player.profile.name}:`, {
                    error: rollbackResult?.error || "Unknown error",
                    promotionId: bet.promotionId,
                });
            }
        } catch (error) {
            this.logService?.logError(`Error rolling back promotion after API failure for player ${player.profile.name}:`, {
                error: error.message,
                promotionId: bet.promotionId,
                stack: error.stack,
            });
        }
    }

    async upsertBet(player, roundId, bet, rate) {
        const configs = this.gameData.gameConfigs;
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            odds: configs.odds,
            roundId,
            clientSeed: bet.clientSeed,
        };

        // Add promotion metadata to bet record
        if (bet.usePromotion && bet.promotionId) {
            newBet.usePromotion = true;
            newBet.promotionId = bet.promotionId;
        }

        const existingBetFilter = { uid: player.UID, roundId };
        const existingBetIncrement = {
            [bet.betChoice]: bet.amount,
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;
            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
            newBet.appType = player.session.system;
        }

        await this.betsRepository.updateOne(
            existingBetFilter,
            { $inc: existingBetIncrement, $setOnInsert: newBet },
            { upsert: true, setDefaultsOnInsert: true }
        );

        return newBet.time;
    }

    async insertBetLog(player, roundId, bet, rate) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            choice: bet.betChoice,
            amount: bet.amount,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            roundId,
        };

        // Add promotion metadata to bet log
        if (bet.usePromotion && bet.promotionId) {
            newBetLog.usePromotion = true;
            newBetLog.promotionId = bet.promotionId;
        }

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
            newBetLog.appType = player.session.system;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    decreaseBetTracks(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] -= amount;
        }
    }

    adjustOwnBets(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            if (!playerInGame.ownBets) {
                playerInGame.ownBets = {};
            }

            playerInGame.ownBets[betChoice] = (playerInGame.ownBets[betChoice] ?? 0) + amount;
        }
    }

    adjustTotalBets(player, bet, rate) {
        const { betChoice, amount } = bet;

        this.gameData.totalBets[betChoice] = (this.gameData.totalBets[betChoice] ?? 0) + amount * rate;
    }

    notifyPlacingBetResult(player, balance, bet, rate) {
        const result = this.generatePlacingBetResult(player, balance, bet, rate);

        this.placeBetPublisher.publishSuccessBet(player.UID, result, rate);
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount, betChoice } = bet;
        const { ownBets } = this.gameData.ingame[player.profile.name] || { ownBets: {} };
        return {
            ownBets: ownBets,
            endBet: amount,
            betChoice,
            user: { ...balance },
        };
    }

    calculateCurrencyRate(session) {
        return session.multiplier * this.gameData.exchangeRates.code[session.currencyCode];
    }

    isCountOnTotalBets(player) {
        return this.gameData.currencies.some(
            (currency) =>
                currency.partnerId === player.session.operatorId &&
                currency.name === player.session.currencyName &&
                !(currency.isTest && currency.isUncountOnTotal)
        );
    }

    /**
     * Process promotion deduction via API
     * @param {Object} player - Player object
     * @param {Object} payload - Bet payload
     * @returns {Promise<Object>} Result with success status
     */
    async processPromotionDeduction(player, payload) {
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

            player.promotion.bonusItemCount = deductResult.remainingBonusItems || promotionData.bonusItemCount - 1;

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
}
