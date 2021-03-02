import mongoose from "mongoose";

export default class RoundQuery {
    /**
     * @param {mongoose.Model} roundsRepository
     */
    constructor(roundsRepository) {
        this.roundsRepository = roundsRepository;
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}

    async getList(limit, projections) {
        const rounds = await this.roundsRepository
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
        const round = await this.roundsRepository.findOne({ id }, projections).lean().exec();

        round.result = round.result ?? this.convertResult(round);
        round.settlementResult = round.settlementResult ?? this.convertSettlementResult(round.result);

        return round;
    }
}
