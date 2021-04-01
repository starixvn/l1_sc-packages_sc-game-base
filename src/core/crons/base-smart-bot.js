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

    async reset(
        { smartBotEnabled, maxBetOfChoices, smartBotGroupRatio, wholeRound },
        { userResetFilters, userUpdateFilters, userUpdates }
    ) {
        if (smartBotEnabled) {
            this.maxBetOfChoices = maxBetOfChoices;
            this.isExpired = await this.betPatternConsumer.resetAndUpdatePatterns({ smartBotEnabled, smartBotGroupRatio }, wholeRound);

            if (this.isExpired) {
                await this.removeAll();
            }

            if (this.smartBots.length === 0) {
                this.smartBots = this.assignPatterns(userResetFilters, userUpdateFilters, userUpdates);
            }
        } else {
            await this.removeAll();
        }

        return this.smartBots;
    }

    async assignPatterns(customResetFilters, customUpdateFilters, customUpdates) {
        const maxInitializeAmount = 88000;
        const minInitializeAmount = 36000;

        const resetFilters = { ...customResetFilters, type: true, patternId: { $gt: 0 } };

        await this.userInfosRepository.updateMany(resetFilters, { patternId: 0 });

        const bots = await this.userInfosRepository.aggregate([
            {
                $match: {
                    ...customUpdateFilters,
                    type: true,
                },
            },
            { $sample: { size: this.patterns.length } },
        ]);

        for (let index = 0; index < this.patterns.length; index++) {
            const pattern = this.patterns[index];
            const bot = bots[index];

            if (bot) {
                const amount = this.chance.integer({ min: minInitializeAmount, max: maxInitializeAmount });
                const updateFilters = { ...customUpdateFilters, id: bot.id, type: true };
                const updates = { ...customUpdates, patternId: pattern._id, red: amount };

                await this.userInfosRepository.updateOne(updateFilters, updates);
            }
        }

        return bots;
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
