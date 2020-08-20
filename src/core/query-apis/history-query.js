import GameDefinition from "../game-definition";

export default class HistoryQuery {
    /**
     * @param {GameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}

    async queryHistory(player, page, pageSize = 8) {
        if (page < 1 || !player) {
            return;
        }

        const filter = { uid: player.UID, thanhtoan: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.definition.betRepository.countDocuments(filter).exec();
        const betProjection = {
            _id: false,
            uid: false,
            thanhtoan: false,
            odds: false,
            siteId: false,
            memberId: false,
            __v: false,
            __archive: false,
        };
        const bets = await this.definition.betRepository
            .find(filter, betProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();
        let betLogs = [];

        if (bets && bets.length > 0) {
            betLogs = await Promise.all(
                bets.map(async (bet) => {
                    const round = await this.definition.roundRepository.findOne({ id: bet.phien }, { _id: false }).lean().exec();
                    const result = round.result ?? this.convertResult(round);
                    const betLogDetails = this.definition.betLogDetails ? await this.getBetLogDetails(player) : [];

                    return {
                        ...bet,
                        result: result,
                        settlementResult: round.settlementResult ?? this.convertSettlementResult(result),
                        betLogDetails,
                    };
                })
            );
        }

        return { history: { betLogs, page, pageSize, total } };
    }

    async getBetLogDetails(player) {
        const betLogDetails = await this.definition.betLogRepository
            .find({ phien: bet.phien, uid: player.UID }, { _id: false, time: true, choice: true, amount: true }, { sort: { _id: -1 } })
            .lean()
            .exec();

        return betLogDetails;
    }
}
