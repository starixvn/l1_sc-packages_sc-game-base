import BetPatternConsumer from "../../../src/core/event-consumers/bet-pattern-consumer";

export default class TableBetPatternConsumer extends BetPatternConsumer {
    async assignPatterns() {
        //TODO add sufficient amount for high stakes bot, smart bots should be random
        for (const pattern of this.patterns) {
            await this.userInfosRepository.updateOne(
                { inRoom: false, inGameRoom: "", disabled: false },
                { patternId: pattern._id, inRoom: true, inGameRoom: this.definition.configName, red: 20000 }
            );
        }
    }
}
