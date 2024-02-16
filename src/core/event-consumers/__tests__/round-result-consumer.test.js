import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import Chance from "chance";
import RoundResultConsumer from "../round-result-consumer";
import GameData from "../../game-data";
import { RoundResultPublisher } from "../../event-publishers";
import Helper from "../../helpers";

jest.mock("../../helpers", () => {
    return {
        SeedHelper: {
            getMergeClientSeed: jest.fn(),
            getSHA256Hash: jest.fn(),
            getSHA512Hash: jest.fn(),
        },
        ServerSeedHelper: {
            generateServerSeed: jest.fn(),
        },
    };
});

const roundResultPublisher = stub(RoundResultPublisher);

const resultsRepository = stubMongoose(mongoose.Model);

const definition = {
    generateResult: jest.fn(),
};

describe("roundResultConsumer", () => {
    const chance = new Chance();
    const roundId = chance.natural();
    const pf = {
        serverSeed: chance.guid(),
        serverSeedHash: chance.guid(),
        clientSeeds: [
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
        ],
        finalHash: chance.guid(),
    };
    let consumer, gameData;

    beforeEach(() => {
        gameData = new GameData();
        gameData.roundId = roundId;
        gameData.pf = pf;
        consumer = new RoundResultConsumer(gameData, definition, roundResultPublisher, resultsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("generateResult", () => {
        beforeEach(() => {
            consumer.generateFinalSeeds = jest.fn().mockReturnValueOnce(pf);
        });

        describe("when control this round result from admin", () => {
            it("should set gameData.result", () => {
                // Arrange
                const expectResult = chance.floating();
                gameData.settlementResultFromAdmin = { roundId, result: expectResult };

                // Act
                consumer.generateResult();

                // Assert
                expect(gameData.result).toBe(expectResult);
            });
        });

        describe("when result is NOT controlled", () => {
            const result = chance.floating();

            beforeEach(() => {
                definition.generateResult.mockReturnValueOnce(result);
            });

            it("should call generateFinalSeeds", async () => {
                // Act
                await consumer.generateResult();

                // Assert
                expect(consumer.generateFinalSeeds).toBeCalledWith(pf);
            });

            it("should update resultsRepository", async () => {
                // Act
                await consumer.generateResult();

                // Assert
                expect(resultsRepository.findOneAndUpdate).toBeCalledWith({ roundId }, pf);
            });

            it("should call definition.generateResult", async () => {
                // Act
                await consumer.generateResult();

                // Assert
                expect(definition.generateResult).toBeCalledWith(pf.finalHash);
            });

            it("should set gameData.result", async () => {
                // Act
                await consumer.generateResult();

                // Assert
                expect(gameData.result).toBe(result);
            });
        });
    });

    describe("generateFinalSeeds", () => {
        const mergeClientSeed = chance.string();
        const sha512Hash = chance.guid();
        const mergeSeed = pf.serverSeed + mergeClientSeed;

        beforeEach(() => {
            Helper.SeedHelper.getMergeClientSeed.mockReturnValueOnce(mergeClientSeed);
            Helper.SeedHelper.getSHA512Hash.mockReturnValueOnce(sha512Hash);
        });

        it("should call getMergeClientSeed", () => {
            // Act
            consumer.generateFinalSeeds(pf);

            // Assert
            expect(Helper.SeedHelper.getMergeClientSeed).toBeCalledWith(pf.clientSeeds);
        });

        it("should call getMergeClientSeed", () => {
            // Act
            consumer.generateFinalSeeds(pf);

            // Assert
            expect(Helper.SeedHelper.getSHA512Hash).toBeCalledWith(mergeSeed);
        });

        it("should return pf data", () => {
            // Act
            const result = consumer.generateFinalSeeds(pf);

            // Assert
            expect(result).toStrictEqual({ clientSeeds: pf.clientSeeds, mergeClientSeed, mergeSeed, finalHash: sha512Hash });
        });
    });

    describe("generateServerSeedAndPublishHash", () => {
        const randomMode = chance.natural();
        const serverSeed = chance.guid();
        const sha256Hash = chance.guid();

        beforeEach(() => {
            gameData.gameConfigs = {
                randomMode,
            };
            consumer.createResultRecord = jest.fn();
            Helper.ServerSeedHelper.generateServerSeed.mockReturnValueOnce(serverSeed);
            Helper.SeedHelper.getSHA256Hash.mockReturnValueOnce(sha256Hash);
        });

        it("should call generateServerSeed", () => {
            // Act
            consumer.generateServerSeedAndPublishHash();

            // Assert
            expect(Helper.ServerSeedHelper.generateServerSeed).toBeCalledWith(randomMode);
        });

        it("should call getSHA256Hash", () => {
            // Act
            consumer.generateServerSeedAndPublishHash();

            // Assert
            expect(Helper.SeedHelper.getSHA256Hash).toBeCalledWith(serverSeed);
        });

        it("should call createResultRecord", async () => {
            // Act
            await consumer.generateServerSeedAndPublishHash();

            // Assert
            expect(consumer.createResultRecord).toBeCalledWith(serverSeed, sha256Hash);
        });

        it("should call roundResultPublisher.publishServerSeedHash", async () => {
            // Act
            await consumer.generateServerSeedAndPublishHash();

            // Assert
            expect(roundResultPublisher.publishServerSeedHash).toBeCalled();
        });
    });

    describe("createResultRecord", () => {
        it("should call resultsRepository.create", async () => {
            // Arrange
            const { serverSeed, serverSeedHash } = pf;
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);

            // Act
            await consumer.createResultRecord(serverSeed, serverSeedHash);

            // Assert
            expect(resultsRepository.create).toBeCalledWith({ roundId, serverSeedHash, serverSeed, time: mockDate });
        });
    });
});
