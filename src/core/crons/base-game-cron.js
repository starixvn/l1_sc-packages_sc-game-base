import cron from "cron";
import mongoose from "mongoose";
import { logger } from "sc-common";

import SettleGameRoundConsumer from "./../event-consumers/settle-game-round-consumer";
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
    }

    async start() {
        const lastRound = await this.roundsRepository
            .findOne({}, "id", { sort: { id: -1 } })
            .lean()
            .exec();
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

        if (lastRound) {
            this.gameData.roundId = lastRound.id + 1;
        } else {
            this.gameData.roundId = await this.getLastArchiveRound();
        }

        await this.getSettingForNewRound();
        await this.updateExchangeRates();

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

        this.gameData.gameConfigs = configs ?? {};
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
            this.gameStatusPublisher.publishEnablingGameStatus();
        } else {
            this.gameStatusPublisher.publishStartGame();
        }
    }

    resetForNewRound() {
        this.gameData.ingame = {};
        this.gameData.totalBets = {};
        this.gameData.settlementResultFromAdmin = {};
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
            .find({ enabled: true }, "name code multiplier enabled partnerId groupId")
            .lean()
            .exec();
    }
}
