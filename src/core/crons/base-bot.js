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
     */
    constructor(definition, gameData, userInfosRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.userInfosRepository = userInfosRepository;

        this.bots = [];
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

                const totalBots = await this.userInfosRepository.countDocuments({ type: true, banned: false }).exec();
                this.maxNumberOfBots = Math.floor(totalBots * this.currentBotRatio);
            }

            await this.processDisabledBots();
        } else {
            await this.removeAllBots();
        }

        this.resetAllBotData();
    }

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
        }
    }

    async removeAllBots() {
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

    async placeBet(bot) {}

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
