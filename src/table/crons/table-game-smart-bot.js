import BaseSmartBot from "./../../core/crons/base-smart-bot";

export default class TableGameSmartBot extends BaseSmartBot {
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
