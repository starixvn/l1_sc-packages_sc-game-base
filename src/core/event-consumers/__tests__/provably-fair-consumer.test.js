import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import Chance from "chance";
import ProvablyFairConsumer from "../provably-fair-consumer";
import GameData from "../../game-data";

describe("ProvablyFairConsumer", () => {
    const chance = new Chance();
    const roundId = chance.natural();
    let consumer, gameData;

    const betsRepository = stubMongoose(mongoose.Model);
    const tempBetsRepository = stubMongoose(mongoose.Model);

    beforeEach(() => {
        gameData = new GameData();
        gameData.roundId = roundId;
        gameData.pf = { clientSeeds: [], serverSeed: "", serverSeedHash: "" };
        consumer = new ProvablyFairConsumer(gameData, betsRepository, tempBetsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("updateClientSeedsFromBets", () => {
        beforeEach(() => {
            consumer.getBetsFromDatabase = jest.fn().mockResolvedValue([
                { name: "Player1", clientSeed: "123", time: new Date("2024-03-12T17:14:00") },
                { name: "Player2", clientSeed: "456", time: new Date("2024-03-12T17:15:00") },
                { name: "Player3", clientSeed: "789", time: new Date("2024-03-12T17:13:00") },
            ]);
        });
        describe("when not limit client seeds", () => {
            beforeEach(() => {
                consumer.limitClientSeeds = false;
                consumer.maxCombinedClientSeeds = 0;
            });
            it("should set correct clientSeeds", async () => {
                // Arrange
                const expectedResult = [
                    { name: "Player3", clientSeed: "789" },
                    { name: "Player1", clientSeed: "123" },
                    { name: "Player2", clientSeed: "456" },
                ];

                // Act
                await consumer.updateClientSeedsFromBets();

                // Assert
                expect(gameData.pf.clientSeeds).toEqual(expectedResult);
            });
        });

        describe("when limit client seeds", () => {
            beforeEach(() => {
                consumer.limitClientSeeds = true;
                consumer.maxCombinedClientSeeds = 1;

            });
            it("should set correct clientSeeds", async () => {
                // Arrange
                const expectedResult = [{ name: "Player3", clientSeed: "789" }];

                // Act
                await consumer.updateClientSeedsFromBets();

                // Assert
                expect(gameData.pf.clientSeeds).toEqual(expectedResult);
            });
        });
    });
});
