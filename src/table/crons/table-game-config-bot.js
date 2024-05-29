import mongoose from "mongoose";
import { helpers } from "sc-common";

import { BaseEventPublisher } from "../../core/event-publishers";
import TableGameData from "../table-game-data";
import TableGameDefinition from "../table-game-definition";
import TableGameBot from "./table-game-bot";

export default class TableGameConfigBot extends TableGameBot {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {GameManagementApiClientFactory} mongoose
     * @param {mongoose.Model} tempBetsRepository
     */
    constructor(definition, gameData, publisher, gameManagementApiClientFactory, tempBetsRepository) {
        super(definition, gameData, publisher, gameManagementApiClientFactory, tempBetsRepository);
        this.hedgeBetGroups = definition.hedgeBetGroups;

        this.betOptions = definition.choices;
        this.smallTicketRatio = 70;
        this.smallTickets = 0;
        this.botSettings = definition.botSettings;
        this.allBets = {};
        this.botChips = [
            20_000_000, 5_000_000, 1_000_000, 500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 2000, 1000, 500, 200, 100, 50, 10, 5, 1,
        ];
    }

    resetAllBotData() {
        super.resetAllBotData();
        this.betOptions.forEach((opt) => {
            this.allBets[opt] = 0;
        });

        this.smallTickets = 0;
    }

    getBetChoice(bot) {
        const betChoiceRatios = this.getBetChoicesRatios();
        const underRatioGroups = helpers.arrayHelper.shuffle(betChoiceRatios.filter((data) => data.underBetRatio));
        const choice = underRatioGroups.length > 0 ? this.chance.pickone(underRatioGroups[0].group) : this.chance.pickone(this.betOptions);
        const hedgeBetGroup = this.hedgeBetGroups.find((group) => group.includes(choice));

        if (hedgeBetGroup) {
            const oppositeChoice = choice === hedgeBetGroup[0] ? hedgeBetGroup[1] : hedgeBetGroup[0];
            return bot.choices.includes(oppositeChoice) ? oppositeChoice : choice;
        } else {
            return choice;
        }
    }

    getBetChoicesRatios() {
        const totalBotBet = this.getAllBetAmountOnChoices(this.betOptions);
        return Object.keys(this.botSettings.ratio).map((group) => {
            const betOptions = this.botSettings[group];
            return {
                group: betOptions,
                underBetRatio: (this.getAllBetAmountOnChoices(betOptions) * 100) / totalBotBet < this.botSettings.ratio[group],
            };
        });
    }

    getAllBetAmountOnChoices(choices) {
        return choices.reduce((total, choice) => total + (this.allBets[choice] ?? 0), 0);
    }

    getMaxBet(_, choice) {
        const gameConfigs = this.gameData.gameConfigs;
        const minBet = this.getMinBet();
        const maxBetPerChoice = gameConfigs.choices_maxbet?.[choice];
        const botMaxBet = gameConfigs.bot_maxbet;
        const maxBet = maxBetPerChoice ? Math.min(maxBetPerChoice, botMaxBet) : botMaxBet;
        const isSmallTicket = this.totalTickets === 0 ? true : (this.smallTickets * 100) / this.totalTickets < this.smallTicketRatio;
        const maxBetOfSmallTicket = Math.min(minBet * 50, botMaxBet * 0.3);
        return isSmallTicket ? maxBetOfSmallTicket : maxBet;
    }

    convertAmountToChip(amount) {
        const chipList = this.botChips.filter((chip) => amount / chip >= 1);

        return chipList.length > 0 ? chipList[0] : this.getMinBet();
    }

    updateBotInRoomData(bot, choice, amount, balance) {
        super.updateBotInRoomData(bot, choice, amount, balance);
        this.allBets[choice] = this.allBets[choice] ? this.allBets[choice] + amount : amount;
        this.smallTickets += amount <= this.getMinBet() * 50 ? 1 : 0;
    }
}
