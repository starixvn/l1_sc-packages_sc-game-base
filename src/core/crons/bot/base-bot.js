import { userInfos } from "sc-base-database";
import { helpers } from "sc-common";

import GameDefinition from "../../game-definition";
import { BasePublisher } from "./../../event-publishers";
import GameData from "./../../game-data";

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

                const bots = await userInfos.find({ type: true }).lean().exec();
                this.maxNumberOfBots = Math.floor(bots.length * this.currentBotRatio);

                const disabledBots = bots.filter((bot) => bot.disabled);
                disabledBots.forEach((bot) => this.removeBot(bot.id));
            }
        } else {
            await this.removeAllBots();
        }

        this.resetAllBotData();
    }

    async run() {}

    async removeAllBots() {}

    async removeBot(botId) {}

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
