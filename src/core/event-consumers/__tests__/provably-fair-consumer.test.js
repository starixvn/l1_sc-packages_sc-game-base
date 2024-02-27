import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import Chance from "chance";
import ProvablyFairConsumer from "../provably-fair-consumer";
import GameData from "../../game-data";

const betsRepository = stubMongoose(mongoose.Model);

const tempBetsRepository = stubMongoose(mongoose.Model);

const definition = {};

describe("ProvablyFairConsumer", () => {
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
        consumer = new ProvablyFairConsumer(gameData, betsRepository, tempBetsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("always set default MaxCombinedClientSeeds as 5", () => {
        // Assert
        expect(consumer.MaxCombinedClientSeeds).toBe(5);
    });

    describe("reset", () => {
        it("should reset relevant pf data to default", () => {
            //Arrange
            const expected = { clientSeeds: [], serverSeed: "" };
            consumer.setServerSeed("server seed");
            consumer.addClientSeed({ name: "player", clientSeed: "client seed" });

            // Act
            consumer.reset();

            // Assert
            expect(consumer.gameData.pf).toStrictEqual(expected);
        });
    });

    describe("setServerSeed", () => {
        it("should assign value", () => {
            //Arrange
            const expected = "server seed";

            // Act
            consumer.setServerSeed(expected);

            // Assert
            expect(consumer.gameData.pf.serverSeed).toStrictEqual(expected);
        });
    });

    describe("setServerSeedHash", () => {
        it("should assign value", () => {
            //Arrange
            const expected = "server seed hash";

            // Act
            consumer.setServerSeedHash(expected);

            // Assert
            expect(consumer.gameData.pf.serverSeedHash).toStrictEqual(expected);
        });
    });

    describe("addClientSeed", () => {
        it("should add new client seed", () => {
            //Arrange
            const clientSeed = { name: "player", clientSeed: "clientSeed" };

            // Act
            consumer.addClientSeed(clientSeed);

            // Assert
            expect(consumer.gameData.pf.clientSeeds[0]).toStrictEqual(clientSeed);
        });

        describe("when reach max client seeds", () => {
            it("should not add new client seed", () => {
                //Arrange
                const clientSeed = { name: "player", clientSeed: "clientSeed" };
                consumer.gameData.pf.clientSeeds = [clientSeed, clientSeed, clientSeed, clientSeed, clientSeed];

                // Act
                consumer.addClientSeed(clientSeed);

                // Assert
                expect(consumer.gameData.pf.clientSeeds.length).toBe(consumer.MaxCombinedClientSeeds);
            });
        });

        describe("sortByTime", () => {
            it("should sort bets by time ascending", () => {
                //Arrange
                const firstBet = { id: 1, time: Date.now() };
                const secondBet = { id: 2, time: Date.now() + 2 };

                // Act
                const sorted = consumer.sortByTime([secondBet, firstBet]);

                // Assert
                expect(sorted[0]).toStrictEqual(firstBet);
            });
        });

        describe("updateClientSeedFromBets", () => {
            beforeEach(() => {
                jest.spyOn(consumer, "sortByTime");
                consumer.sortByTime.mockReturnValueOnce([{ id: 1, time: Date.now() }]);

                jest.spyOn(consumer, "getFirstBets");
                consumer.getFirstBets.mockReturnValueOnce([{ id: 1, time: Date.now() }]);

                jest.spyOn(consumer, "addClientSeed");
            });

            it("shoud call getFirstBets", async () => {
                // Act
                await consumer.updateClientSeedFromBets();

                // Assert
                expect(consumer.getFirstBets).toBeCalledTimes(1);
            });

            it("shoud call sortByTime", async () => {
                // Act
                await consumer.updateClientSeedFromBets();

                // Assert
                expect(consumer.sortByTime).toBeCalledTimes(1);
            });

            it("shoud call addClientSeed", async () => {
                // Act
                await consumer.updateClientSeedFromBets();

                // Assert
                expect(consumer.addClientSeed).toBeCalledTimes(1);
            });
        });
    });
});
