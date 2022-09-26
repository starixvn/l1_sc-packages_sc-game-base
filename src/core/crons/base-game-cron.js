import cron from "cron";
import mongoose from "mongoose";
import { logger } from "sc-common";

import SettleGameRoundConsumer from "./../event-consumers/settle-game-round-consumer";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import BaseBot from "./base-bot";
import { decrypt } from "../helpers/crypto-helper";
import { getEffectivePromotion, getStartPromotionMessage, getFinishPromotionMessage } from "../helpers/promotion-helper";
import { chatBotHelper } from "../helpers";

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
     * @param {mongoose.Model} dependencies.gameConfigsRepository
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.archiveStatusesRepository
     * @param {mongoose.Model} dependencies.notificationRepository
     * @param {mongoose.Model} dependencies.exchangeRatesRepository
     * @param {mongoose.Model} dependencies.currencyGroupGamesRepository
     * @param {mongoose.Model} dependencies.partnerConfigRepository
     * @param {mongoose.Model} dependencies.currencyGroupRepository
     * @param {mongoose.Model} dependencies.currencyRepository
     */
    constructor({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveStatusesRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        resultsRepository,
        promotionRepository,
        appConfigs,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.bot = bot;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.gameStatusPublisher = gameStatusPublisher;
        this.runningRoundInfoPublisher = runningRoundInfoPublisher;
        this.logService = logService;
        this.gameConfigsRepository = gameConfigsRepository;
        this.roundsRepository = roundsRepository;
        this.archiveStatusesRepository = archiveStatusesRepository;
        this.notificationRepository = notificationRepository;
        this.exchangeRatesRepository = exchangeRatesRepository;
        this.currencyGroupGamesRepository = currencyGroupGamesRepository;
        this.partnerConfigRepository = partnerConfigRepository;
        this.currencyGroupRepository = currencyGroupRepository;
        this.currencyRepository = currencyRepository;
        this.roundResultConsumer = roundResultConsumer;
        this.resultsRepository = resultsRepository;
        this.promotionRepository = promotionRepository;
        this.appConfigs = appConfigs;
    }

    async start() {
        await this.initRoundId();
        await this.queryLastResult();
        await this.initResultHash();
        await this.getSettingForNewRound();
        await this.updateExchangeRates();
        this.startCron();
    }

    async initRoundId() {
        const lastRound = await this.roundsRepository
            .findOne({}, "id", { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            this.gameData.roundId = lastRound.id + 1;
        } else {
            this.gameData.roundId = await this.getLastArchiveRound();
        }
    }

    async queryLastResult() {
        if (this.resultsRepository) {
            this.gameData.lastResultRecord = await this.resultsRepository.findOne({ roundId: this.gameData.roundId }).lean().exec();
        }
    }

    async initResultHash() {
        if (this.resultsRepository) {
            const previousResultRecord = await this.resultsRepository
                .findOne({ roundId: this.gameData.roundId - 1 })
                .lean()
                .exec();

            if (previousResultRecord) {
                this.gameData.result = JSON.parse(decrypt(previousResultRecord.encryptedResult));
                this.gameData.resultHash = JSON.parse(decrypt(previousResultRecord.encryptedResultHash));
            }
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

    async getLastArchiveRound() {
        const { configName } = this.definition;
        const archiveStatus = await this.archiveStatusesRepository.findOne({ name: configName }, "lastArcId").lean().exec();

        return archiveStatus ? archiveStatus.lastArcId["_phiens"] + 1 : 1;
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.isStartingTime(this.gameData.remainingTime, durations)) {
            this.resetForNewRound();
            this.bot && (await this.bot.reset());
            this.appConfigs.enabledBoostedOdds && (await this.updatePromotionOddsAndNotify());
        }

        if (this.gameData.remainingTime === durations.placingBets && this.resultsRepository) {
            await this.roundResultConsumer.generateResultAndPublishHash(this.gameData.lastResultRecord);
            this.gameData.settlementResultFromAdmin = {};
        }

        if (this.gameData.remainingTime === durations.placingBets) {
            this.gameStatusPublisher.publishStartPlacingBetStatus();
        }

        if (this.gameData.remainingTime === durations.lockingBet - 1) {
            this.gameStatusPublisher.publishEndPlacingBetStatus();
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;

            await this.settleGameRoundConsumer.settleRound(this.gameData);
        } else if (this.gameData.remainingTime < durations.placingBets) {
            this.bot && (await this.bot.run());
            this.runningRoundInfoPublisher.publish();
        }
    }

    isStartingTime(remainingTime, durations) {
        return remainingTime === durations.placingBets;
    }

    async checkGameStatus() {
        const { configName, durations } = this.definition;
        const configs = await this.gameConfigsRepository.findOne({ name: configName }).lean().exec();
        const previouslyDisabled = this.gameData.disabled;
        const configuredlyDisabled = !configs || !configs.enabled;

        if (previouslyDisabled) {
            if (this.gameData.delayStartTime > 0) {
                this.gameData.delayStartTime--;
            } else if (!configuredlyDisabled) {
                this.gameData.delayStartTime = configs?.delayStartTime ?? 0;
            }
        }

        this.gameData.umMessages =
            (await this.notificationRepository.findOne({ gameName: configName, displayKind: 2 }, "messages").lean().exec())?.messages ?? {};

        const originalOdds = configs ? Object.assign({}, configs.odds) : {};
        if (this.gameData.gameConfigs && this.gameData.gameConfigs.boostedChoices && this.gameData.gameConfigs.boostedChoices.length > 0) {
            this.gameData.gameConfigs = configs
                ? Object.assign(configs, { odds: this.gameData.gameConfigs.odds, boostedChoices: this.gameData.gameConfigs.boostedChoices })
                : {};
        } else {
            this.gameData.gameConfigs = configs ?? {};
        }
        this.gameData.gameConfigs.originalOdds = originalOdds;

        this.gameData.disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;
        await this.getSettingForNewRound();

        if (this.gameData.gameConfigs.exchangeReload) {
            await this.updateExchangeRates();
            await this.gameConfigsRepository.updateOne({ name: configName }, { exchangeReload: false });
            this.gameData.gameConfigs.exchangeReload = false;
        }

        if (this.gameData.disabled) {
            this.gameData.remainingTime = durations.wholeRound;
            this.gameStatusPublisher.publishDisableGameStatus();

            await this.gameConfigsRepository.updateOne({ name: configName }, { disabledround: this.gameData.roundId });
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

        const promotions = await this.promotionRepository.find({ gameId: this.definition.id, status: "enabled" }).lean().exec();
        const promotion = getEffectivePromotion(promotions);
        this.gameData.promotion = promotion;

        this.gameData.gameConfigs.boostedChoices = [];
        if (promotion) {
            const boostedOdds = promotion.odds;
            const originalOdds = this.gameData.gameConfigs.originalOdds;
            Object.keys(originalOdds).forEach((choice) => {
                if (boostedOdds[choice] && boostedOdds[choice] !== originalOdds[choice]) {
                    this.gameData.gameConfigs.boostedChoices.push(choice);
                    this.gameData.gameConfigs.odds[choice] = boostedOdds[choice];
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
    }

    async getSettingForNewRound() {
        await this.updateCurrencyGroupGames();
        await this.updatePartnerGameSiteExclusions();
        await this.updateCurrencyGroups();
        await this.updateCurrencies();
    }

    async updateExchangeRates() {
        this.gameData.exchangeRates = await this.exchangeRatesRepository
            .findOne({}, "exId code", { sort: { exId: -1 } })
            .lean()
            .exec();
    }

    async updateCurrencyGroupGames() {
        this.gameData.currencyGroupGames = await this.currencyGroupGamesRepository
            .find({ gameId: this.definition.id, enabled: true }, "groupId minBet maxBet maxBetPerChoices chips stakeLevels")
            .lean()
            .exec();
    }

    async updatePartnerGameSiteExclusions() {
        this.gameData.partnerGameSiteExclusions = await this.partnerConfigRepository
            .find({ type: "game_site_exclusions" }, "partnerId type value")
            .lean()
            .exec();
    }

    async updateCurrencyGroups() {
        this.gameData.currencyGroups = await this.currencyGroupRepository.find({ enabled: true }, "name enabled partnerId").lean().exec();
    }

    async updateCurrencies() {
        this.gameData.currencies = await this.currencyRepository
            .find({ enabled: true }, "name code multiplier enabled partnerId groupId isTest isUncountOnTotal")
            .lean()
            .exec();
    }

    async enableGame() {
        this.gameStatusPublisher.publishEnablingGameStatus();
    }
}
