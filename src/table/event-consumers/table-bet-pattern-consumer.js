import BetPatternConsumer from "../../../src/core/event-consumers/bet-pattern-consumer";

export default class TableBetPatternConsumer extends BetPatternConsumer {
    async assignPatterns() {
        for (const pattern of this.patterns) {
            await this.userInfosRepository.updateOne(
                { inRoom: false, inGameRoom: "", disabled: false },
                { patternId: pattern._id, inRoom: true, inGameRoom: this.definition.configName }
            );
        }
    }
}
