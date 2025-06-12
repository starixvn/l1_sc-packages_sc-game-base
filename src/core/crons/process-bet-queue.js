import mongoose from "mongoose";
import { helpers } from "sc-common";
import { tracer } from "sc-instrument";

import BaseMetrics from "../base-metrics";
import GameManagementApiClientFactory, { getOrDefault, callAndForget } from "../game-management-api";
import { PlaceBetPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import EventInterceptorMixin from "../mixins/event-interceptor-mixin.js";

// Create the base class with interceptor functionality
class BaseBetProcessor {
    constructor() {
        // Base class for ProcessBetQueue
    }
}

// Apply the mixin to create the enhanced class
const BetProcessorWithInterceptors = EventInterceptorMixin(BaseBetProcessor);

export default class ProcessBetQueue extends BetProcessorWithInterceptors {
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
     * @param {Array} dependencies.betEventInterceptors - Array of bet event interceptors
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
        betEventInterceptors = [],
    }) {
        super();

        this.definition = definition;
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.placeBet = placeBet;
        this.logService = logService;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.baseMetrics = baseMetrics;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();

        // Initialize interceptor system from mixin
        this.initializeInterceptors(betEventInterceptors, "bet");
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
        // Get applicable interceptors for this bet - follows established pattern
        const applicableInterceptors = this.getApplicableInterceptors({ payload });

        if (!(await this.validateBetRequest(player, payload))) {
            return;
        }

        // Execute beforeEvent interceptors - similar to how consumers work
        const beforeEventResult = await this.executeInterceptorEvent("beforeEvent", applicableInterceptors, {
            player,
            payload,
        });

        if (!beforeEventResult.success) {
            return; // Error already handled by interceptor
        }

        // Transform bet info with interceptors - similar to data transformation in other components
        let betInfo = this.formatApiBetInfo(payload);
        betInfo = this.executeInterceptorTransform("enhanceBetInfo", applicableInterceptors, {
            betInfo,
            payload,
        });

        const apiResult = await this.placeBet({ id: player.UID, session: player.session }, betInfo);
        const { response } = apiResult;

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, response, betInfo.gameRoundId, payload, applicableInterceptors);
        } else {
            await this.handleFailedBet(player, response, payload, applicableInterceptors);

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
            await this.handleFailedBet(player, failedCriterion.notice, payload, []);
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
        return {
            amount: payload.amount,
            gameId: this.definition.id,
            gameRoundId: payload.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            clientSentTime: payload.time ?? new Date(),
            metadata: {
                mode: `${payload.mode}`,
            },
        };
    }

    async handleSuccessBet(player, balance, roundId, bet, applicableInterceptors) {
        const rate = this.calculateCurrencyRate(player.session);

        if (this.betLogsRepository) {
            await this.insertBetLog(player, roundId, bet, rate, applicableInterceptors);
        }

        const betTime = await this.upsertBet(player, roundId, bet, rate, applicableInterceptors);

        if (this.isCountOnTotalBets(player)) {
            this.adjustTotalBets(player, bet, rate);
        }

        this.adjustOwnBets(player.profile.name, bet);

        // Execute afterSuccessEvent interceptors
        if (applicableInterceptors) {
            await this.executeInterceptorEvent("afterSuccessEvent", applicableInterceptors, {
                player,
                bet,
                balance,
                betTime,
            });
        }

        if (player.promotion && player.promotion.bonusItemCount <= 0) {
            const totalWin = await this.gamePromotionApiClient.getTotalWin({
                promotionId: player.promotion.promotionId,
                playerId: player.session.playerId,
                operatorId: player.session.operatorId
            });
            this.placeBetPublisher.placeBetPublisher(player.UID, {
                endPromotion: { totalWin: totalWin },
            });
            delete player.promotion;
        }

        const balanceValue = balance?.red || balance?.balance || 0;
        callAndForget(
            this.gameManagementApiClient.users.setBalanceAndDecreaseScoins({
                id: player.UID,
                balance: balanceValue,
                deductionscoins: 0,
            })
        );
        this.notifyPlacingBetResult(player, balance, bet, rate);

        if (player.profile.minBet !== balance?.minBet || player.profile.maxBet !== balance?.maxBet) {
            this.updateUserStakeLevel(player, balance?.minBet, balance?.maxBet);
        }
    }

    async handleFailedBet(player, notice, bet, applicableInterceptors) {
        const { betChoice } = bet;
        this.decreaseBetTracks(player.profile.name, bet);

        // Execute afterFailureEvent interceptors
        if (applicableInterceptors) {
            await this.executeInterceptorEvent("afterFailureEvent", applicableInterceptors, {
                player,
                bet,
                notice,
            });
        }

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    async upsertBet(player, roundId, bet, rate, applicableInterceptors) {
        const configs = this.gameData.gameConfigs;
        let newBet = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            odds: configs.odds,
            roundId,
            clientSeed: bet.clientSeed,
        };

        // Transform bet record with interceptors
        if (applicableInterceptors) {
            newBet = this.executeInterceptorTransform("enhanceBetRecord", applicableInterceptors, {
                betRecord: newBet,
                bet,
            });
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

    async insertBetLog(player, roundId, bet, rate, applicableInterceptors) {
        let newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            choice: bet.betChoice,
            amount: bet.amount,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            roundId,
        };

        // Transform bet log with interceptors
        if (applicableInterceptors) {
            newBetLog = this.executeInterceptorTransform("enhanceBetLog", applicableInterceptors, {
                betLog: newBetLog,
                bet,
            });
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
}
