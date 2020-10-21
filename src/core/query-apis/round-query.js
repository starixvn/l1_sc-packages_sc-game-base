import GameDefinition from "./../game-definition";

export default class RoundQuery {
    /**
     * @param {GameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}

    async getList(limit, projections) {
        const rounds = await this.definition.roundRepository
            .find({}, projections, { sort: { _id: -1 }, limit: limit })
            .lean()
            .exec();

        return rounds.map((round) => {
            const result = round.result ?? this.convertResult(round);
            const settlementResult = round.settlementResult ?? this.convertSettlementResult(result);

            return {
                roundId: round.id,
                result,
                settlementResult,
            };
        });
    }

    async getOne(id, projections = { _id: false }) {
        const round = await this.definition.roundRepository.findOne({ id }, projections).lean().exec();

        round.result = round.result ?? this.convertResult(round);
        round.settlementResult = round.settlementResult ?? this.convertSettlementResult(result);

        return round;
    }
}
