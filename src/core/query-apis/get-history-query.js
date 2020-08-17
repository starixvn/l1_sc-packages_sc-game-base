import GameDefinition from "../game-definition";
import { logger } from "sc-common";

export default class GetHistoryQuery {
    /**
     * @param {GameDefinition} definition
     */

    constructor(definition) {
        this.definition = definition;
    }

    async queryHistory(player, page, pageSize) {
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
                    const round = await this.definition.roundRepository
                        .findOne({ id: bet.phien }, { _id: false, result: true, settlementResult: true })
                        .lean()
                        .exec();
                    const betLogDetails = await this.definition.betLogRepository
                        .find(
                            { phien: bet.phien, uid: player.UID },
                            { _id: false, time: true, choice: true, amount: true },
                            { sort: { _id: -1 } }
                        )
                        .lean()
                        .exec();

                    return { ...bet, result: round.result, settlementResult: round.settlementResult, betLogDetails };
                })
            );
        }

        player.red({ [this.definition.name]: { history: { betLogs, page, pageSize, total } } });
    }
}
