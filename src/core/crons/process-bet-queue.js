import mongoose from "mongoose";
import { helpers, logger } from "sc-common";

import BaseMetrics from "../base-metrics";
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
     * @param {mongoose.Model} dependencies.userInfosRepository
     * @param {BaseMetrics} dependencies.baseMetrics
     */
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        baseMetrics,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.placeBet = placeBet;
        this.logService = logService;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.userInfosRepository = userInfosRepository;
        this.baseMetrics = baseMetrics;
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
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    this.proceedBet(player, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(this.logService.logError);
                }
            });
        }
    }

    async proceedBet(player, payload) {
        const betInfo = this.formatApiBetInfo(payload);

        if (!(await this.validateBetRequest(player, payload))) {
            return;
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
                await this.updateUserStakeLevel(player, response.apiError.minBet, response.apiError.maxBet);
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
        const betAmountValidationCriteria = (await this.composeBalanceValidationCriteria(player, payload)) || [];
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(payload.roundId) ?? [];

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria);
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

    async composeBalanceValidationCriteria(player, payload) {
        if (payload.freeBet) {
            const coins = await this.getCoinBalance(player);

            return [
                {
                    failure: coins < payload.amount,
                    notice: { errorCode: helpers.noticeHelper.notEnoughScoin },
                },
            ];
        }

        return [];
    }

    async getCoinBalance(player) {
        const userInfo = await this.userInfosRepository.findOne({ id: player.UID }, "scoins").lean().exec();

        return userInfo.scoins ?? 0;
    }

    async updateUserStakeLevel(player, minBet, maxBet) {
        await this.userInfosRepository.updateOne({ id: player.UID }, { minBet, maxBet, betLimitModifiedDate: new Date() });
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
            freeBet: payload.freeBet,
            clientSentTime: payload.time ?? new Date(),
        };
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        if (this.betLogsRepository) {
            await this.insertBetLog(player, roundId, bet, rate);
        }

        await this.upsertBet(player, roundId, bet, rate);

        this.adjustTotalBets(player, bet, rate);
        this.notifyPlacingBetResult(player, balance, bet, rate);

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    handleFailedBet(player, notice, bet) {
        const { betChoice } = bet;
        this.decreaseBetTracks(player.profile.name, bet);

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    async upsertBet(player, roundId, bet, rate) {
        const configs = this.gameData.gameConfigs;
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
            time: new Date(),
            odds: configs.odds,
            freeBet: bet.freeBet,
        };
        const existingBetFilter = { uid: player.UID, phien: roundId, freeBet: bet.freeBet };
        const existingBetIncrement = {
            [bet.betChoice]: bet.amount,
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.memberId = player.session.memberId;
            newBet.siteId = player.session.siteId;
            newBet.partnerId = player.session.partnerId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;
        }

        await this.betsRepository.updateOne(
            existingBetFilter,
            { $inc: existingBetIncrement, $setOnInsert: newBet },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    async insertBetLog(player, roundId, bet, rate) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
            time: new Date(),
            choice: bet.betChoice,
            amount: bet.amount,
            freeBet: bet.freeBet,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
        };

        if (player.session) {
            newBetLog.memberId = player.session.memberId;
            newBetLog.siteId = player.session.siteId;
            newBetLog.partnerId = player.session.partnerId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;
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

    adjustTotalBets(player, bet, rate) {
        const { betChoice, amount } = bet;

        this.gameData.totalBets[betChoice] = (this.gameData.totalBets[betChoice] ?? 0) + amount * rate;
    }

    notifyPlacingBetResult(player, balance, bet, rate) {
        const result = this.generatePlacingBetResult(player, balance, bet);

        this.placeBetPublisher.publishSuccessBet(player.UID, result, rate);
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount, freeBet, betChoice } = bet;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };

        return {
            ownBets: betTracks,
            endBet: amount,
            betChoice,
            freeBet,
            user: { ...balance },
        };
    }

    calculateCurrencyRate(session) {
        return session.multiplier * this.gameData.exchangeRates.code[session.currencyCode];
    }
}
