import mongoose from "mongoose";

import RoundQuery from "./round-query";

export default class HistoryQuery {
    /**
     * @param {RoundQuery} roundQuery
     * @param {mongoose.Model} betsRepository
     * @param {mongoose.Model} betLogsRepository
     */
    constructor(roundQuery, betsRepository, betLogsRepository) {
        this.roundQuery = roundQuery;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
    }

    convertBet(bet) {
        return bet;
    }

    async queryHistory(player, page, pageSize) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, thanhtoan: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.betsRepository.countDocuments(filter).exec();
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
        const bets = await this.betsRepository
            .find(filter, betProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();
        let betLogs = [];

        if (bets && bets.length > 0) {
            betLogs = await Promise.all(
                bets.map(async (bet) => {
                    const round = await this.roundQuery.getOne(bet.phien, { _id: false });
                    const betLogDetails = this.betLogsRepository ? await this.getBetLogDetails(player, bet.phien) : [];

                    return {
                        ...this.convertBet(bet),
                        result: round.result,
                        settlementResult: round.settlementResult,
                        betLogDetails,
                    };
                })
            );
        }

        return { history: { betLogs, page, pageSize, total } };
    }

    getBetLogDetails(player, roundId) {
        return this.betLogsRepository
            .find({ phien: roundId, uid: player.UID }, { _id: false, time: true, choice: true, amount: true }, { sort: { _id: -1 } })
            .lean()
            .exec();
    }
}
