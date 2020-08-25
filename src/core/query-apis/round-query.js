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
            return {
                roundId: round.id,
                result: round.result ?? this.convertResult(round),
                settlementResult: round.settlementResult ?? this.convertSettlementResult(result),
            };
        });
    }

    async getOne(id, projections) {
        const round = await this.definition.roundRepository.findOne({ id }, projections).exec();

        return {
            roundId: round.id,
            result: round.result ?? this.convertResult(round),
            settlementResult: round.settlementResult ?? this.convertSettlementResult(result),
        };
    }
}
