import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { RoundQuery } from "..";

describe("round query test", () => {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    const roundQuery = new RoundQuery(roundsRepository);
    beforeEach(() => {
        spyOn(roundQuery, "convertResult");
        spyOn(roundQuery, "convertSettlementResult");
    });

    describe("getList", () => {
        describe("result is null", () => {
            it("should calls convertResult", async () => {
                // arrange
                const rounds = [{ id: 1, result: null }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
            });
        });

        describe("result is undefined", () => {
            it("should calls convertResult", async () => {
                // arrange
                const rounds = [{ id: 1, result: undefined }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
            });
        });

        describe("when result is not null/undefined", () => {
            it("should not call convertResult", async () => {
                // arrange
                const result = { red1: true, red2: false, red3: true, red4: false };
                const rounds = [{ id: 1, result }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertResult).not.toHaveBeenCalled();
            });
        });

        describe("when settlementResult is null", () => {
            it("should calls convertSettlementResult", async () => {
                // arrange
                const rounds = [{ id: 1, settlementResult: null }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
            });
        });

        describe("when settlementResult is undefined", () => {
            it("should calls convertSettlementResult", async () => {
                // arrange
                const rounds = [{ id: 1, settlementResult: undefined }];
                roundsRepository.find().lean().exec.mockReturnValueOnce(rounds);

                // act
                await roundQuery.getList(10, {});

                // assert
                expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
            });
        });

        describe("when settlementResult is not null/undefined", () => {
            it("should not call convertResult", async () => {
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
    });

    describe("getOne test", () => {
        describe("when result/settlement is null", () => {
            it("should calls convertResult && convertSettlementResult", async () => {
                // arrange
                const round = { id: 1, result: null, settlementResult: null };
                roundsRepository.findOne().lean().exec.mockReturnValueOnce(round);

                // act
                await roundQuery.getOne(1);
                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
                expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
            });
        });

        describe("when result/settlement is undefined", () => {
            it("should calls convertResult && convertSettlementResult", async () => {
                // arrange
                const round = { id: 1, result: undefined, settlementResult: undefined };
                roundsRepository.findOne().lean().exec.mockReturnValueOnce(round);

                // act
                await roundQuery.getOne(1);
                // assert
                expect(roundQuery.convertResult).toHaveBeenCalled();
                expect(roundQuery.convertSettlementResult).toHaveBeenCalled();
            });
        });

        describe("when result/settlementResult is valid", () => {
            it("should return them without converting", async () => {
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
});
