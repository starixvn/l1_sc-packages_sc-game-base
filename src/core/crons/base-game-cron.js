import cron from "cron";
import mongoose from "mongoose";

import GameManagementApiClientFactory, { getOrDefault, post } from "../game-management-api";
import { chatBotHelper } from "../helpers";
import { getEffectivePromotion, getFinishPromotionMessage, getStartPromotionMessage } from "../helpers/promotion-helper";
import { RoundResultConsumer, SettleGameRoundConsumer, RoundIdConsumer } from "./../event-consumers";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import BaseBot from "./base-bot";

export default class BaseGameCron {
    /**
     *
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {BaseBot} dependencies.bot
     * @param {SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {GameStatusPublisher} dependencies.gameStatusPublisher
     * @param {RunningRoundInfoPublisher} dependencies.runningRoundInfoPublisher
     * @param {logger} dependencies.logService
     * @param {RoundResultConsumer} dependencies.roundResultConsumer
     * @param {mongoose.Model} dependencies.resultsRepository
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {RoundIdConsumer} dependencies.roundIdConsumer
     * @param {ProvablyFairConsumer} dependencies.provablyFairConsumer
     * @param {UnsettledRoundConsumer} dependencies.unsettledRoundConsumer
     */
    constructor({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        roundResultConsumer,
        resultsRepository,
        appConfigs,
        gameManagementApiClientFactory,
        roundIdConsumer,
        provablyFairConsumer,
        unsettledRoundConsumer,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.bot = bot;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.gameStatusPublisher = gameStatusPublisher;
        this.runningRoundInfoPublisher = runningRoundInfoPublisher;
        this.logService = logService;
        this.roundResultConsumer = roundResultConsumer;
        this.resultsRepository = resultsRepository;
        this.appConfigs = appConfigs;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
        this.roundIdConsumer = roundIdConsumer;
        this.provablyFairConsumer = provablyFairConsumer;
        this.unsettledRoundConsumer = unsettledRoundConsumer;
    }

    async start() {
        await this.roundIdConsumer.initRoundId();
        await this.queryLastResult();
        await this.getSettingForNewRound();
        await this.updateExchangeRates();
        await this.unsettledRoundConsumer.proceed();
        this.startCron();
    }

    async queryLastResult() {
        if (this.isHashedResult()) {
            this.gameData.lastResultRecord = await this.resultsRepository.findOne({ roundId: this.gameData.roundId }).lean().exec();
        }
    }

    startCron() {
        const job = new cron.CronJob(
            "* * * * * *",
            () => this.proceed().catch(this.logService.logError),
            () => {
                this.logService.logError(
                    `${this.definition.name} unexpectedly stopped at round #${this.gameData.roundId} because some other tasks halt it.`
                );
                job.start();
            }
        );

        job.start();
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        const remainingTime = this.gameData.remainingTime;
        if (this.isStartingTime(remainingTime, durations)) {
            this.resetForNewRound();
            this.bot && this.bot.reset();
            this.appConfigs.enabledBoostedOdds && (await this.updatePromotionOddsAndNotify());
        }

        if (this.gameData.remainingTime === durations.placingBets && this.isHashedResult()) {
            await this.roundResultConsumer.generateServerSeedAndPublishHash(this.gameData.lastResultRecord);
            this.gameData.settlementResultFromAdmin = {};
        }

        if (remainingTime === durations.placingBets) {
            this.gameStatusPublisher.publishStartPlacingBetStatus();
        }

        if (remainingTime === durations.lockingBet - 1) {
            this.gameStatusPublisher.publishEndPlacingBetStatus();
        }

        if (this.gameData.remainingTime === durations.mergeClientSeeds && this.isHashedResult()) {
            await this.provablyFairConsumer.updateClientSeedsFromBets();
            await this.roundResultConsumer.generateResult();
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;

            await this.settleGameRoundConsumer.settleRound(this.gameData);
        } else if (remainingTime < durations.placingBets) {
            this.bot && (await this.bot.run());
            this.runningRoundInfoPublisher.publish();
        }
    }

    isStartingTime(remainingTime, durations) {
        return remainingTime === durations.placingBets;
    }

    isHashedResult() {
        return this.definition.provablyFair || this.resultsRepository;
    }

    async checkGameStatus() {
        const { configName } = this.definition;

        const newGameConfigs = await getOrDefault(
            this.gameManagementApiClient.gameConfigs.getGameConfigs(configName),
            this.gameData.gameConfigs
        );

        if (!newGameConfigs) {
            this.logService.logError(`Cannot get game configs of ${this.definition.name}.`);
        }

        const previouslyDisabled = this.gameData.disabled;
        const configuredlyDisabled = !newGameConfigs || !newGameConfigs.enabled;

        if (previouslyDisabled) {
            this.gameData.delayStartTime = this.getDelayStartTime(configuredlyDisabled, newGameConfigs);
        }

        this.assignNewGameConfigs(newGameConfigs);

        this.gameData.disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        await this.getSettingForNewRound();

        if (this.gameData.gameConfigs.exchangeReload) {
            await this.updateExchangeRates();

            await post(this.gameManagementApiClient.gameConfigs.updateExchangeReload(false, configName));
        }

        this.handleGameStatus(previouslyDisabled);
    }

    assignNewGameConfigs(newGameConfigs) {
        newGameConfigs.originalOdds = newGameConfigs.odds;

        const { gameConfigs: currentGameConfig } = this.gameData;

        if (currentGameConfig.boostedChoices?.length > 0) {
            newGameConfigs = Object.assign(newGameConfigs, {
                odds: currentGameConfig.odds,
                boostedChoices: currentGameConfig.boostedChoices,
            });
        }

        this.gameData.gameConfigs = newGameConfigs ?? {};
    }

    async handleGameStatus(previouslyDisabled) {
        const { configName } = this.definition;

        if (this.gameData.disabled) {
            const { durations } = this.definition;

            const notification = await getOrDefault(this.gameManagementApiClient.notification.getUmMessages(configName), {});

            this.gameData.umMessages = notification;

            this.gameData.remainingTime = durations.wholeRound;
            this.gameStatusPublisher.publishDisableGameStatus();
        } else if (previouslyDisabled) {
            await this.enableGame();
        } else {
            this.gameStatusPublisher.publishStartGame();
        }
    }

    async updatePromotionOdds() {
        if (!this.gameData.gameConfigs || !this.gameData.gameConfigs.odds) {
            return {};
        }

        const promotions = await getOrDefault(this.gameManagementApiClient.promotion.getPromotions(this.definition.id), []);

        const promotion = getEffectivePromotion(promotions);
        this.gameData.promotion = promotion;

        this.gameData.gameConfigs.boostedChoices = [];
        this.gameData.gameConfigs.odds = Object.assign({}, this.gameData.gameConfigs.originalOdds);

        if (promotion) {
            Object.keys(this.gameData.gameConfigs.odds).forEach((choice) => {
                if (promotion.odds[choice] && promotion.odds[choice] !== this.gameData.gameConfigs.odds[choice]) {
                    this.gameData.gameConfigs.odds[choice] = promotion.odds[choice];
                    this.gameData.gameConfigs.boostedChoices.push(choice);
                }
            });
        }

        return promotion;
    }

    async updatePromotionOddsAndNotify() {
        const isUsingPromotion = () => {
            return !!this.gameData.promotion;
        };

        const previousPromotion = this.gameData.promotion;
        const havingPreviousPromotion = isUsingPromotion();
        const promotion = await this.updatePromotionOdds();
        const havingNewPromotion = isUsingPromotion();

        this.gameStatusPublisher.publishBoostedOdds();

        if (!havingPreviousPromotion && havingNewPromotion) {
            chatBotHelper.sendBoostedOddsMessage(getStartPromotionMessage(this.definition.name, promotion));
        } else if (havingPreviousPromotion && !havingNewPromotion) {
            chatBotHelper.sendBoostedOddsMessage(
                getFinishPromotionMessage(this.definition.name, previousPromotion, this.gameData.gameConfigs?.odds)
            );
        }
    }

    resetForNewRound() {
        this.gameData.ingame = {};
        this.gameData.totalBets = {};
        this.provablyFairConsumer.reset();
    }

    async getSettingForNewRound() {
        const data = await getOrDefault(this.gameManagementApiClient.aggregation.getSettingForNewRound(this.definition.id), {
            currencyGroupGames: this.gameData.currencyGroupGames,
            partnerGameSiteExclusions: this.gameData.partnerGameSiteExclusions,
            currencyGroups: this.gameData.currencyGroups,
            currencies: this.gameData.currencies,
        });

        this.gameData.currencyGroupGames = data.currencyGroupGames;
        this.gameData.partnerGameSiteExclusions = data.partnerGameSiteExclusions;
        this.gameData.currencyGroups = data.currencyGroups;
        this.gameData.currencies = data.currencies;
    }

    async updateExchangeRates() {
        this.gameData.exchangeRates = await getOrDefault(
            this.gameManagementApiClient.exchangeRates.getExchangeRates(),
            this.gameData.exchangeRates
        );
    }

    async updateCurrencyGroupGames() {
        this.gameData.currencyGroupGames = await getOrDefault(
            this.gameManagementApiClient.currencyGroupGames.getCurrencyGroupGamesByGameId(this.definition.id),
            this.gameData.currencyGroupGames
        );
    }

    async updatePartnerGameSiteExclusions() {
        this.gameData.partnerGameSiteExclusions = await getOrDefault(
            this.gameManagementApiClient.operatorConfig.getGameSiteExclusions(),
            this.gameData.partnerGameSiteExclusions
        );
    }

    async updateCurrencyGroups() {
        this.gameData.currencyGroups = await getOrDefault(
            this.gameManagementApiClient.currencyGroups.getCurrencyGroups(),
            this.gameData.currencyGroups
        );
    }

    async updateCurrencies() {
        this.gameData.currencies = await getOrDefault(this.gameManagementApiClient.currencies.getCurrencies(), this.gameData.currencies);
    }

    async enableGame() {
        this.gameStatusPublisher.publishEnablingGameStatus();
    }

    getDelayStartTime(configuredlyDisabled, newGameConfigs) {
        if (this.gameData.delayStartTime > 0) {
            return this.gameData.delayStartTime - 1;
        }

        if (!configuredlyDisabled) {
            return newGameConfigs?.delayStartTime ?? 0;
        }

        return 0;
    }
}
