import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { RoundQuery } from "..";

describe("round query test", () => {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);
    /** @type {mongoose.Model}*/
    const resultsRepository = stubMongoose(mongoose.Model);

    const roundQuery = new RoundQuery(roundsRepository, resultsRepository);
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

    describe("getRoundPF", () => {
        describe("when round doesnt exist", () => {
            it("should only return roundId & serverSeedHash", async () => {
                //Arrange
                const pfResult = {
                    clientSeeds: [],
                    roundId: 1,
                    serverSeedHash: "ff4403253b351eea6bb90bb103fedd8de55710fc8e0b932df1d6039b98e7abc5",
                    serverSeed: "1MsJRn3EV4P6RkLKBU3s22Dlc3wEAd0TOl2CE0wb",
                    finalHash:
                        "14a4b12258dd153265951f00c7f4c781d5fd6174e3423be6e5bcea55d8eda9a4da1ea52ef90bef029ae185cb8cde9bd9dad59ed107e6e3257e5b2aee1df1eba1",
                    mergeClientSeed: "",
                    mergeSeed: "1MsJRn3EV4P6RkLKBU3s22Dlc3wEAd0TOl2CE0wb",
                };

                roundsRepository.findOne().lean().exec.mockReturnValueOnce(null);
                resultsRepository.findOne().lean().exec.mockReturnValueOnce(pfResult);

                //Act
                const result = await roundQuery.getRoundPF(1);

                //Assert
                expect(result).toEqual({
                    roundPFResult: {
                        roundId: 1,
                        serverSeedHash: pfResult.serverSeedHash,
                    },
                });
            });
        });

        describe("when round exists", () => {
            it("should return all pf data", async () => {
                //Arrange
                const round = { result: 22.2 };
                const pfResult = {
                    clientSeeds: [],
                    roundId: 1,
                    serverSeedHash: "ff4403253b351eea6bb90bb103fedd8de55710fc8e0b932df1d6039b98e7abc5",
                    serverSeed: "1MsJRn3EV4P6RkLKBU3s22Dlc3wEAd0TOl2CE0wb",
                    finalHash:
                        "14a4b12258dd153265951f00c7f4c781d5fd6174e3423be6e5bcea55d8eda9a4da1ea52ef90bef029ae185cb8cde9bd9dad59ed107e6e3257e5b2aee1df1eba1",
                    mergeClientSeed: "",
                    mergeSeed: "1MsJRn3EV4P6RkLKBU3s22Dlc3wEAd0TOl2CE0wb",
                };

                roundsRepository.findOne().lean().exec.mockReturnValueOnce(round);
                resultsRepository.findOne().lean().exec.mockReturnValueOnce(pfResult);

                //Act
                const result = await roundQuery.getRoundPF(1);

                //Assert
                expect(result).toEqual({
                    roundPFResult: {
                        result: round.result,
                        ...pfResult,
                    },
                });
            });
        });
    });
});
