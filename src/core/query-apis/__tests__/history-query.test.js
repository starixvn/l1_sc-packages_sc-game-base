import RoundQuery from "../round-query";
import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import HistoryQuery from "../history-query";

jest.mock("../round-query");

describe("history quer test", () => {
    const roundQuery = new RoundQuery();
    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);
    /** @type {mongoose.Model}*/
    const betLogsRepository = stubMongooseModelStupidly(mongoose.Model);

    describe("queryHistory tests", () => {
        it("should return empty when page < 1", async () => {
            const historyQuery = new HistoryQuery(roundQuery, betsRepository, betLogsRepository);

            var actualResult = await historyQuery.queryHistory({}, 0, 10);

            expect(actualResult).toBeEmpty();
        });

        it("should return data when page >= 1", async () => {
            const historyQuery = new HistoryQuery(roundQuery, betsRepository, betLogsRepository);
            roundQuery.getOne.mockReturnValueOnce({
                id: 1,
                result: { red1: true, red2: false },
                settlementResult: { odd: true, even: false },
            });
            betsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
            betsRepository.countDocuments().exec.mockReturnValueOnce(1);
            betsRepository
                .find()
                .lean()
                .exec.mockReturnValueOnce([{ uid: 1, phien: 1, odd: 100, even: 50 }]);
            betLogsRepository
                .find()
                .lean()
                .exec.mockReturnValueOnce([
                    { uid: 1, phien: 1, choice: "odd" },
                    { uid: 1, phien: 1, choice: "even" },
                ]);

            var actualResult = await historyQuery.queryHistory({ UID: 1 }, 1, 10);

            expect(actualResult).not.toBeEmpty();
            expect(actualResult.history.page).toEqual(1);
            expect(actualResult.history.pageSize).toEqual(10);
            expect(actualResult.history.total).toEqual(1);
            expect(actualResult.history.betLogs).toHaveLength(1);
        });
    });
});
