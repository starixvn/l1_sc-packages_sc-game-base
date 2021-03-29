import mongoose from "mongoose";

import BaseSmartBot from "./../../core/crons/base-smart-bot";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableGameSmartBot extends BaseSmartBot {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {mongoose.Model} userInfosRepository
     * @param {BetPatternConsumer} betPatternConsumer
     * @param {mongoose.Model} smartBotBetLogsRepository
     */

    constructor(definition, gameData, betPatternConsumer, smartBotBetLogsRepository, userInfosRepository) {
        super(definition, gameData, betPatternConsumer, smartBotBetLogsRepository);

        this.userInfosRepository = userInfosRepository;
        this.maxBetOfChoices = null;
    }

    async reset(smartBotEnabled, maxBetOfChoices) {
        if (smartBotEnabled) {
            this.maxBetOfChoices = maxBetOfChoices;
            this.isExpired = await this.betPatternConsumer.resetAndUpdatePatterns();

            if (this.isExpired) {
                await this.removeAll();
            }

            if (this.smartBots.length === 0) {
                this.smartBots = await this.userInfosRepository
                    .find(
                        { type: true, inRoom: true, inGameRoom: this.definition.configName, patternId: { $gt: 0 } },
                        "-_id id name red avatarId type patternId"
                    )
                    .lean()
                    .exec();
            }
        } else {
            await this.removeAll();
        }
    }

    async placeBet(bot, betAction, roundId) {
        if (!betAction) {
            return;
        }

        const { choice, amount } = this.generateChoiceAndAmount(betAction);

        if (this.gameData.remainingTime > this.definition.durations.lockingBet) {
            const user = await this.userInfosRepository
                .findOneAndUpdate({ id: bot.id, red: { $gt: amount } }, { $inc: { red: -amount } }, { new: true })
                .lean();

            if (user) {
                await this.insertBetActionLogs(bot, { choiceId: betAction.choiceId, amount, second: betAction.second, roundId });

                this.afterPlaceBet(bot, botAmount, choice, amount);
            }
        }
    }

    generateChoiceAndAmount(betAction) {
        const { choiceId, amount } = betAction ?? { choiceId: 0, amount: 0 };
        const choice = this.convertBetChoice(choiceId);

        return choice && amount > 0 ? { choice, amount: this.reduceAmountIfOverMaxBet(choice, amount) } : { choice, amount };
    }

    reduceAmountIfOverMaxBet(choice, amount) {
        const maxBetPerChoice = this.maxBetOfChoices[choice] || 0;

        return Math.min(amount, maxBetPerChoice);
    }
}
