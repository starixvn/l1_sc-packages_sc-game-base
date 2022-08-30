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

    convertBetLogs(betLogDetails) {
        return betLogDetails;
    }

    async queryHistory(player, page, pageSize) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, paid: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.betsRepository.countDocuments(filter).exec();
        const betProjection = {
            _id: false,
            uid: false,
            siteId: false,
            playerId: false,
            __v: false,
            __archive: false,
            currency: false,
            operatorId: false,
            paid: false,
        };

        const bets = await this.betsRepository
            .find(filter, betProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();
        let betLogs = [];

        if (bets && bets.length > 0) {
            betLogs = await Promise.all(
                bets.map(async (bet) => {
                    const round = await this.roundQuery.getOne(bet.roundId, { _id: false });
                    const betLogDetails = this.betLogsRepository ? await this.getBetLogDetails(player, bet.roundId) : [];

                    return {
                        ...this.convertBet(bet),
                        result: round.result,
                        settlementResult: round.settlementResult,
                        betLogDetails: this.convertBetLogs(betLogDetails),
                    };
                })
            );
        }

        return { history: { betLogs, page, pageSize, total } };
    }

    getBetLogDetails(player, roundId) {
        return this.betLogsRepository
            .find(
                { roundId, uid: player.UID },
                { _id: false, time: true, choice: true, amount: true, select: true, bet: true },
                { sort: { _id: -1 } }
            )
            .lean()
            .exec();
    }
}
