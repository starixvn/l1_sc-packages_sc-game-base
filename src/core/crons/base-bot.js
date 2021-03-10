import Chance from "chance";
import mongoose from "mongoose";
import { helpers } from "sc-common";

import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseBot {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} userInfosRepository
     * @param {BetPatternConsumer} betPatternConsumer
     */
    constructor(definition, gameData, userInfosRepository, betPatternConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.userInfosRepository = userInfosRepository;
        this.betPatternConsumer = betPatternConsumer;

        this.bots = [];
        this.smartBots = [];
        this.currentBotRatio = 0;
        this.maxNumberOfBots = 0;

        this.totalTickets = 0;
        this.totalSmallTickets = 0;
        this.totalBets = {};

        this.chance = new Chance();
    }

    async reset() {
        const configs = this.gameData.gameConfigs;

        if (configs.botenabled) {
            const botRatio = helpers.configHelper.getMaxBotForCurrentHour(configs);

            if (this.currentBotRatio !== botRatio) {
                this.currentBotRatio = botRatio;

                const totalBots = await this.userInfosRepository.countDocuments({ type: true, disabled: false }).exec();
                this.maxNumberOfBots = Math.floor(totalBots * this.currentBotRatio);
            }

            await this.processDisabledBots();
            await this.resetSmartPatterns();
        } else {
            await this.removeAllBots();
        }

        this.resetAllBotData();
    }

    async resetSmartPatterns() {}

    async run() {
        if (
            this.bots.length &&
            this.gameData.gameConfigs?.botenabled &&
            this.gameData.remainingTime > this.definition.durations.lockingBet
        ) {
            const maxBotRandom = this.bots.length / this.gameData.remainingTime;
            const botsToBet = this.chance.integer({ min: (maxBotRandom * 2) / 3, max: maxBotRandom });
            const indicesOfBotsToBeRemoved = [];

            for (let botIndex = 0; botIndex < botsToBet; botIndex++) {
                const bot = this.bots[botIndex];

                if (bot) {
                    await this.placeBet(bot);
                    indicesOfBotsToBeRemoved.push(botIndex);
                }
            }

            indicesOfBotsToBeRemoved.forEach((index) => {
                this.bots.splice(index, 1);
            });

            if (this.gameData.gameConfigs?.smartBotEnabled) {
                await this.assignBetActionAndPlaceBet();
            }
        }
    }

    async assignBetActionAndPlaceBet() {
        this.smartBots.forEach((smartBot) => {
            smartBot.betActions = this.betPatternConsumer.getBetActions(smartBot.patternId);
        });

        for (const smartBot of this.smartBotstBotsToBet) {
            const actionsInSecond = smartBot.betActions.filter((betAction) => betAction.second === this.gameData.remainingTime) ?? [];
            for (const action of actionsInSecond) {
                await this.placeBet(smartBot, action);
            }
        }
    }

    async removeAllBots() {
        //TODO remove smart bots?
        this.bots = [];
        this.currentBotRatio = 0;
        this.maxNumberOfBots = 0;
    }

    async removeBot(botId) {}

    async processDisabledBots() {}

    resetAllBotData() {
        this.totalTickets = 0;
        this.totalSmallTickets = 0;
        this.totalBets = {};
    }

    resetBot(bot) {}

    async placeBet(bot, betAction = null) {}

    getBetChoice(bot) {}

    getMaxBet(bot, choice) {}

    getMinBet() {
        return Math.max(1, this.gameData.gameConfigs.minbet);
    }

    getTotalBetAmount(bet) {
        let totalBet = 0;

        if (bet) {
            this.definition.choices.forEach((choice) => {
                totalBet += bet[choice] ?? 0;
            });
        }

        return totalBet;
    }
}
