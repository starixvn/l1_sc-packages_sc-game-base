import BetPatternConsumer from "../../../src/core/event-consumers/bet-pattern-consumer";

export default class TableBetPatternConsumer extends BetPatternConsumer {
    async assignPatterns() {
        const initAmountForHighStakeBot = 60000;

        await this.userInfosRepository.updateMany(
            { type: true, inRoom: true, inGameRoom: this.definition.configName, patternId: { $gt: 0 } },
            { patternId: 0 }
        );

        const bots = await this.userInfosRepository.aggregate([
            {
                $match: {
                    type: true,
                    inRoom: false,
                    inGameRoom: "",
                    disabled: false,
                },
            },
            { $sample: { size: this.patterns.length } },
        ]);

        for (let index = 0; index < this.patterns.length; index++) {
            const pattern = this.patterns[index];
            const bot = bots[index];
            if (bot) {
                await this.userInfosRepository.updateOne(
                    { id: bot.id, inRoom: false, inGameRoom: "", disabled: false },
                    { patternId: pattern._id, inRoom: true, inGameRoom: this.definition.configName, red: initAmountForHighStakeBot }
                );
            }
        }
    }
}
