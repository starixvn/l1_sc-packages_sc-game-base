import Chance from "chance";
import mongoose from "mongoose";

export default class BaseSmartBot {
    /**
     * @param {BetPatternConsumer} betPatternConsumer
     * @param {mongoose.Model} smartBotBetLogsRepository
     */

    constructor(choiceMapper, betPatternConsumer, smartBotBetLogsRepository, userInfosRepository) {
        this.betPatternConsumer = betPatternConsumer;
        this.smartBotBetLogsRepository = smartBotBetLogsRepository;
        this.userInfosRepository = userInfosRepository;

        this.smartBots = [];
        this.chance = new Chance();
        this.isExpired = false;
        this.choiceMapper = choiceMapper;

        this.maxBetOfChoices = null;
        this.afterPlacingBet = null;
        this.beforeRemovingAll = null;
    }

    async reset({ smartBotEnabled, maxBetOfChoices }, customFilters, customProjections) {
        const filters = { ...customFilters, patternId: { $gt: 0 } };
        const projections = { ...customProjections, patternId: true };

        if (smartBotEnabled) {
            this.maxBetOfChoices = maxBetOfChoices;
            this.isExpired = await this.betPatternConsumer.resetAndUpdatePatterns();

            if (this.isExpired) {
                await this.removeAll();
            }

            if (this.smartBots.length === 0) {
                this.smartBots = await this.userInfosRepository.find(filters, projections).lean().exec();
            }
        } else {
            await this.removeAll();
        }

        return this.smartBots;
    }

    async removeAll() {
        await this.beforeRemovingAll(this.smartBots);
        this.smartBots = [];
    }

    async run({ smartBotEnabled, remainingTime, lockingBet }) {
        if (this.smartBots.length && smartBotEnabled && remainingTime > lockingBet) {
            this.smartBots.forEach((smartBot) => {
                smartBot.betActions = this.betPatternConsumer.getBetActions(smartBot.patternId);
            });

            for (const smartBot of this.smartBots) {
                const actionsInSecond = smartBot.betActions.filter((betAction) => betAction.second === remainingTime) ?? [];
                for (const action of actionsInSecond) {
                    await this.placeBet(smartBot, action);
                }
            }
        }
    }

    async placeBet(bot, betAction, roundId) {}

    generateChoiceAndAmount(betAction) {
        const { choiceId, amount } = betAction ?? { choiceId: 0, amount: 0 };
        const choice = this.convertBetChoice(choiceId);

        return choice && amount > 0 ? { choice, amount: this.reduceAmountIfOverMaxBet(choice, amount) } : { choice, amount };
    }

    convertBetChoice(choiceId) {
        return choiceId > 0 ? this.choiceMapper[choiceId - 1] : null;
    }

    reduceAmountIfOverMaxBet(choice, amount) {
        const maxBetPerChoice = this.maxBetOfChoices[choice] || 0;

        return Math.min(amount, maxBetPerChoice);
    }

    async insertBetActionLogs(bot, { choiceId, amount, second, roundId }) {
        if (this.smartBotBetLogsRepository) {
            await this.smartBotBetLogsRepository.create({
                uid: bot.id,
                name: bot.name,
                patternId: bot.patternId,
                round: roundId,
                time: new Date(),
                choiceId,
                amount,
                second,
            });
        }
    }

    getSmartBots() {
        return this.smartBots;
    }
}
