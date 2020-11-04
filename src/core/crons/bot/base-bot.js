import { userInfos } from "sc-base-database";
import { helpers } from "sc-common";

import { BasePublisher } from "./../../event-publishers";
import GameData from "./../../game-data";
import GameDefinition from "./../../game-definition";

export default class BaseBot {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BasePublisher} publisher
     */
    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher ?? new BasePublisher(this.definition.name, gameData);

        this.currentBotRatio = 0;
        this.maxNumberOfBots = 0;
        this.totalTickets = 0;
        this.totalBets = {};
        this.resetBotData = {
            totalBet: 0,
            choices: {},
            red: 0,
            remainTickets: 0,
            betOnChoices: {},
        };
    }

    async reset() {
        const configs = this.gameData.gameConfigs;

        if (configs.botenabled) {
            const botRatio = helpers.configHelper.getMaxBotForCurrentHour(configs);

            if (this.currentBotRatio !== botRatio) {
                this.currentBotRatio = botRatio;

                const totalBots = await userInfos.countDocuments({ type: true, banned: false }).exec();
                this.maxNumberOfBots = Math.floor(totalBots * this.currentBotRatio);
            }

            await this.processDisabledBots();
        } else {
            await this.removeAllBots();
        }

        this.resetAllBotData();
    }

    async run() {}

    async removeAllBots() {}

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
