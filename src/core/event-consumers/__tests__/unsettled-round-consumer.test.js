import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import ProvablyFairConsumer from "../provably-fair-consumer";
import RoundResultConsumer from "../round-result-consumer";
import SettleGameRoundConsumer from "../settle-game-round-consumer";
import UnsettledRoundConsumer from "../unsettled-round-consumer";

const definition = new GameDefinition({}, jest.fn());
let gameData;

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const tempBetsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);
const settleGameRoundConsumer = stub(SettleGameRoundConsumer);
const roundResultConsumer = stub(RoundResultConsumer);
const provablyFairConsumer = stub(ProvablyFairConsumer);

beforeEach(() => {
    gameData = new GameData(3);
});

afterEach(() => {
    jest.clearAllMocks();
});

function initConsumer() {
    return new UnsettledRoundConsumer({
        gameData,
        definition,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        settleGameRoundConsumer,
        roundResultConsumer,
        provablyFairConsumer,
    });
}

describe("unsettledRoundConsumer", () => {
    describe("generateResult", () => {
        describe("when lastResultRecord has finalHash", () => {
            it("should call definition.generateResult", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();
                gameData.lastResultRecord = { finalHash: "hash" };

                // Act
                await unsettledRoundConsumer.generateResult([]);

                // Assert
                expect(definition.generateResult).toHaveBeenCalledWith(gameData.lastResultRecord.finalHash);
            });
        });

        describe("when lastResultRecord does not have finalHash", () => {
            it("should call provablyFairConsumer.setServerSeed", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed", serverSeedHash: "serverSeedHash" };

                // Act
                await unsettledRoundConsumer.generateResult([]);

                // Assert
                expect(provablyFairConsumer.setServerSeed).toHaveBeenCalledWith(gameData.lastResultRecord.serverSeed);
            });

            it("should call provablyFairConsumer.setServerSeedHash", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed", serverSeedHash: "serverSeedHash" };

                // Act
                await unsettledRoundConsumer.generateResult([]);

                // Assert
                expect(provablyFairConsumer.setServerSeedHash).toHaveBeenCalledWith(gameData.lastResultRecord.serverSeedHash);
            });

            it("should call roundResultConsumer.generateResult", async () => {
                // Arrange
                const unsettledRoundConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed" };

                // Act
                await unsettledRoundConsumer.generateResult([]);

                // Assert
                expect(roundResultConsumer.generateResult).toHaveBeenCalled();
            });
        });
    });

    describe("getUnsettledBets", () => {
        it("should return array containing bot bets and player bets", async () => {
            // Arrange
            const unsettledRoundConsumer = initConsumer();
            gameData.roundId = 100;
            const playerBets = [
                { name: "player1", clientSeed: "seed1", time: new Date() },
                { name: "player2", clientSeed: "seed2", time: new Date(new Date().getTime() + 10000) },
                { name: "player3", clientSeed: "seed3", time: new Date(new Date().getTime() + 20000) },
            ];
            const botBets = [
                { name: "bot1", clientSeed: "botseed1", time: new Date() },
                { name: "bot2", clientSeed: "botseed2", time: new Date(new Date().getTime() + 10000) },
                { name: "bot3", clientSeed: "botseed3", time: new Date(new Date().getTime() + 20000) },
            ];

            betsRepository.find().lean().exec.mockReturnValueOnce(playerBets);
            tempBetsRepository.find().lean().exec.mockReturnValueOnce(botBets);

            // Act
            const result = await unsettledRoundConsumer.getUnsettledBets();

            // Assert
            expect(result).toEqual(playerBets.concat(botBets));
        });
    });

    describe("proceed", () => {
        describe("when there is lastResultRecord", () => {
            beforeAll(() => {
                jest.useFakeTimers("modern");
                jest.setSystemTime(new Date(2024, 3, 1));
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            it("should call settleGameRoundConsumer.settleRound", async () => {
                betsRepository.find().lean().exec.mockReturnValueOnce([]);
                tempBetsRepository.find().lean().exec.mockReturnValueOnce([]);
                gameData.lastResultRecord = { serverSeed: "seed", finalHash: "hash" };

                const unsettledRoundConsumer = initConsumer();
                
                // Act
                await unsettledRoundConsumer.proceed();

                // Assert
                expect(settleGameRoundConsumer.settleRound).toHaveBeenCalled();
            })
        });
    });
});
