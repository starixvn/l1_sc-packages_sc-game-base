import { helpers } from "sc-common";
import { verifySeed } from "sc-pf-client-seed";
import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class PlaceBetConsumer {
    DisplayMode = {
        Landscape: "1",
        Portrait: "2",
    };

    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {Object} logService
     */
    constructor(definition, gameData, publisher, logService) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher;
        this.logService = logService;
    }

    /**
     * Get promotional bet amount - can be overridden by specific game services
     * @param {Object} player - Player object
     * @param {Object} payload - Bet payload
     * @returns {number} Promotional bet amount
     */
    getPromotionBetAmount(player, payload) {
        // Default implementation returns 0 for all promotional bets
        // Override this method in specific game services (slot, table, etc.) for custom logic
        return 0;
    }

    /**
     * Main consume method with promotion integration
     * @param {Object} player - Player object
     * @param {Object} payload - Bet payload
     */
    async consume(player, payload) {
        try {
            Object.assign(payload, {
                amount: payload.amount >> 0,
                freeBet: payload.freeBet ?? false,
                roundId: payload.roundId ?? this.gameData.roundId,
                mode: payload.m ?? this.DisplayMode.Landscape,
                receivedTime: new Date(),
            });

            // Handle promotion logic - NEW ADDITION
            this.handlePromotionLogic(player, payload);

            const { betChoice, freeBet, roundId } = payload;
            const name = player.profile.name;

            if (!this.validateRequestParams(payload, player)) {
                return;
            }

            // Validate bet request including promotion eligibility
            if (!this.validateBetRequest(player, betChoice, payload.amount, freeBet, roundId)) {
                return;
            }

            this.initializePlayerData(player, payload);
            this.adjustBetTracks(player.profile.name, payload);
            this.gameData.ingame[name].betQueue.push({ player, payload });
        } catch (error) {
            this.logService?.logError(`Error in place bet consumer for player ${player.profile.name}:`, error);
            this.publisher.publishToUser(player.UID, {
                endBet: -1,
                betChoice: payload?.betChoice || "unknown",
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            });
        }
    }

    handlePromotionLogic(player, payload) {
        const usePromotion = player.promotion !== null && player.promotion && player.promotion.isClaimed;
        player.usePromotion = usePromotion;

        if (usePromotion) {
            const promotionBetAmount = this.getPromotionBetAmount(player, payload);
            Object.assign(payload, {
                amount: promotionBetAmount,
                promotionId: player.promotion.promotionId,
                usePromotion: true,
            });
        }
    }

    /**
     * Initialize player data in game state
     * @param {Object} player - Player object
     * @param {Object} payload - Bet payload
     */
    initializePlayerData(player, payload) {
        const name = player.profile.name;

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],
                clientSeed: payload.clientSeed,
                operatorId: player.session.operatorId,
            };

            if (player.promotion) {
                newPlayer.promotion = { ...player.promotion };
            }

            this.gameData.ingame[name] = newPlayer;
        }
    }

    /**
     * Enhanced validation for promotion bets
     * @param {Object} player - Player object
     * @param {string} betChoice - Bet choice
     * @param {number} amount - Bet amount
     * @param {boolean} freeBet - Is free bet
     * @param {number} roundId - Round ID
     * @returns {boolean} Validation result
     */
    validateBetRequest(player, betChoice, amount, freeBet, roundId) {
        const criteria = this.composeValidationCriteria(player, betChoice, amount, freeBet, roundId);
        return this.verifyCriteria(criteria, player, betChoice);
    }

    /**
     * Enhanced validation criteria including promotion validation
     * @param {Object} player - Player object
     * @param {string} betChoice - Bet choice
     * @param {number} amount - Bet amount
     * @param {boolean} freeBet - Is free bet
     * @param {number} roundId - Round ID
     * @returns {Array} Validation criteria
     */
    composeValidationCriteria(player, betChoice, amount, freeBet, roundId) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId) ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) || [];
        const betChoiceValidationCriteria = this.composeBetChoiceValidationCriteria(betChoice) || [];
        const hedgeBetValidationCriteria = this.composeHedgeBetValidationCriteria(betChoice, player) || [];
        const promotionValidationCriteria = this.composePromotionValidationCriteria(player) || []; // NEW

        return bettingTimeValidationCriteria.concat(
            betChoiceValidationCriteria,
            betAmountValidationCriteria,
            hedgeBetValidationCriteria,
            promotionValidationCriteria
        );
    }

    /**
     * Enhanced bet amount validation with promotion support
     * @param {Object} player - Player object
     * @param {string} betChoice - Bet choice
     * @param {number} amount - Bet amount
     * @param {boolean} freeBet - Is free bet
     * @returns {Array} Validation criteria
     */
    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };

        // Skip amount validation for promotion bets - they use predetermined amounts
        if (player.promotion) {
            return []; // No amount validation needed for promotion bets
        }

        // Regular validation for non-promotion bets
        const totalAmount = this.definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);
        const maxBetPerChoice = Math.min(player.profile.maxBet, settings.maxBetPerChoices[betChoice]);

        return [
            {
                failure: freeBet && !configs.enableFreeBet,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBetForChoice, { maxBet: maxBetPerChoice }),
            },
            {
                failure: amount < minBet,
                notice: this.getNoticeObj(helpers.noticeHelper.minBet, { minBet }),
            },
            {
                failure: amount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
            {
                failure: totalAmount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
        ];
    }

    /**
     * NEW - Promotion specific validation criteria
     * @param {Object} player - Player object
     * @returns {Array} Validation criteria
     */
    composePromotionValidationCriteria(player) {
        // Only validate if player has promotion data
        if (!player.promotion || !player.usePromotion) {
            return [];
        }

        const promotion = player.promotion;
        const currentTime = new Date();

        return [
            {
                failure: !promotion.promotionId,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { msg: "No active promotion" }),
            },
            {
                failure: promotion.endDate && new Date(promotion.endDate) < currentTime,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { msg: "Promotion has expired" }),
            },
            {
                failure: promotion.isActive === false,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { msg: "Promotion is not active" }),
            },
        ];
    }

    composeBettingTimeValidationCriteria(roundId) {
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: roundId !== this.gameData.roundId,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { gameRoundId: roundId }),
            },
            {
                failure:
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [
            {
                failure: !this.definition.choices.includes(betChoice),
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    composeHedgeBetValidationCriteria(betChoice, player) {
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const hedgeBetGroup = this.definition.hedgeBetGroups.find((group) => group.includes(betChoice));

        const isInvalid =
            hedgeBetGroup &&
            Object.keys(betTracks).some((betKey) => betTracks[betKey] && hedgeBetGroup.includes(betKey) && betKey !== betChoice);

        return [
            {
                failure: isInvalid,
                notice: this.getNoticeObj(helpers.noticeHelper.disallowHedgeBet, { hedgeBetGroup }),
            },
        ];
    }

    validateBetRequestParams(request) {
        const { betChoice, amount } = request;

        return [
            {
                failure: !amount || !betChoice,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: amount <= 0,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    validateClientSeed(request) {
        const { clientSeed } = request;

        return [
            {
                failure: !verifySeed(clientSeed),
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    composeRequestParamsValidationCriteria(request) {
        const betAmountValidationCriteria = this.validateBetRequestParams(request) || [];
        const clientSeedCriteria = this.definition.provablyFair ? this.validateClientSeed(request) : [];

        return betAmountValidationCriteria.concat(clientSeedCriteria);
    }

    validateRequestParams(request, player) {
        const criteria = this.composeRequestParamsValidationCriteria(request);
        return this.verifyCriteria(criteria, player, request.betChoice);
    }

    verifyCriteria(criteria, player, betChoice) {
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, betChoice, notice: failedCriterion.notice });
        }

        return failedCriterion === undefined;
    }

    adjustBetTracks(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];
            playerInGame.betTracks[betChoice] = (playerInGame.betTracks[betChoice] ?? 0) + amount;
        }
    }
}
