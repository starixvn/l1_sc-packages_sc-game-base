import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { RoundQuery } from "..";

describe("round query test", () => {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

    const roundQuery = new RoundQuery(roundsRepository);
    beforeEach(() => {
        spyOn(roundQuery, "convertResult");
        spyOn(roundQuery, "convertSettlementResult");
    });

    describe("getList_", () => {
        it.each([null, undefined])("result is null/undefined_calls convertResult", async (result) => {
            // arrange
            const rounds = [{ id: 1, result }];
            roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

            // act
            await roundQuery.getList(10, {});

            // assert
            expect(roundQuery.convertResult).toHaveBeenCalled();
        });

        it("result is not null/undefined_does not call convertResult", async () => {
            // arrange
            const result = { red1: true, red2: false, red3: true, red4: false };
            const rounds = [{ id: 1, result }];
            roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

            // act
            await roundQuery.getList(10, {});

            // assert
            expect(roundQuery.convertResult).not.toHaveBeenCalled();
        });

        it.each([null, undefined])("settlementResult  is null/undefined_calls convertSettlementResult", async (settlementResult) => {
            // arrange
            const rounds = [{ id: 1, settlementResult }];
            roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

            // act
            await roundQuery.getList(10, {});

            // assert
            expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
        });

        it("settlementResult is not null/undefined_does not call convertResult", async () => {
            // arrange
            const settlementResult = { odd: true, even: false };
            const rounds = [{ id: 1, settlementResult }];
            roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

            // act
            await roundQuery.getList(10, {});

            // assert
            expect(roundQuery.convertSettlementResult).not.toHaveBeenCalled();
        });
    });

    describe("getOne test", () => {
        it.each([
            [null, null],
            [undefined, undefined],
        ])(
            "result/settlement is null/undefined, should calls convertResult && convertSettlementResult",
            async (result, settlementResult) => {
                // arrange
                const round = { id: 1, result, settlementResult };
                roundsRepository.findOne().lean().exec.mockReturnValueOnce(round);

                // act
                await roundQuery.getOne(1);
                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
                expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
            }
        );

        it("result/settlementResult is valid, return them without converting", async () => {
            // arrange
            const result = { red1: true, red2: false };
            const settlementResult = { odd: true, even: false };
            const round = { id: 1, result, settlementResult };
            roundsRepository.findOne().lean().exec.mockReturnValueOnce(round);

            // act
            var actualResult = await roundQuery.getOne(1);
            // assert
            expect(roundQuery.convertResult).not.toHaveBeenCalled();
            expect(roundQuery.convertSettlementResult).not.toHaveBeenCalled();

            expect(actualResult).toEqual(round);
        });
    });
});
