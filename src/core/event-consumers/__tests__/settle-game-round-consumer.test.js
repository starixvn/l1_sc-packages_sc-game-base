import { stubMongoose, stub } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RoundResultPublisher from "../../event-publishers/round-result-publisher";
import UserBetResultPublisher from "../../event-publishers/user-bet-result-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import SettleGameRoundConsumer from "../settle-game-round-consumer";
import Chance from "chance";
import { Models } from "jest-auto-fixture";
import GameManagementApiClientFactory from "../../game-management-api";

jest.mock("sc-game-management-client");

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new GameData(30);
    defaultGameData.gameConfigs = Models.GameConfig({
        odds: { odd: 1.96, even: 1.96, red3: 3.75, red4: 14.4, white3: 3.75, white4: 14.4 },
    });

    let gameData, definition, consumer;

    /** @type {UserRoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongoose(mongoose.Model);

    const endGame = jest.fn();
    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

    beforeEach(() => {
        jest.clearAllMocks();
        gameData = { ...defaultGameData };
        definition = { ...defaultDefinition };

        consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
            gameManagementApiClientFactory,
        });
    });

    describe("generateResult", () => {
        const generateResult = { red1: true, red2: true, red3: true, red4: false };

        beforeEach(() => {
            gameData.settlementResultFromAdmin = {
                roundId: 1,
                result: { red1: true, red2: false, red3: true, red4: false },
            };
            gameData.result = { red1: true, red2: false, red3: true, red4: false };
            definition.generateResult.mockReturnValueOnce(generateResult);
        });

        describe("when roundId from admin equal to game data roundId", () => {
            it("should return result from admin", () => {
                // Arrange
                gameData.roundId = 1;

                // Act
                const actualResult = consumer.generateResult();
                // Assert
                expect(actualResult).toEqual(gameData.settlementResultFromAdmin.result);
            });
        });
        describe("when roundId from admin is different from game data roundId", () => {
            it("should return result from generation", () => {
                // Arrange
                gameData.roundId = 2;
                // Act
                const actualResult = consumer.generateResult();

                // Assert
                expect(actualResult).toEqual({ red1: true, red2: false, red3: true, red4: false });
            });
        });
    });

    describe("settleRound", () => {
        const result = { red1: true, red2: true, red3: true, red4: false };
        const settlementResult = { odd: true, even: false };
        const mockDate = new Date();
        const createRoundResult = { id: roundId, result, settlementResult, time: mockDate };
        const collectRoundResult = {
            result,
            settlementResult,
            roundId,
        };

        beforeEach(() => {
            gameData.roundId = roundId;
            gameData.result = { red1: true, red2: true, red3: true, red4: false };
            gameData.winningPlayers = {};
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            consumer.settleBets = jest.fn();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
            roundsRepository.create.mockReturnValueOnce(createRoundResult);
            consumer.collectRoundResult = jest.fn(() => collectRoundResult);
        });

        it("should call settle with generated result", async () => {
            // Act
            await consumer.settleRound();

            // Assert
            expect(definition.settle).toHaveBeenCalledWith(result);
        });

        it("should create new round", async () => {
            // Act
            await consumer.settleRound();

            // Assert
            expect(roundsRepository.create).toHaveBeenCalledWith({
                id: roundId,
                result,
                settlementResult,
                time: mockDate,
            });
        });

        describe("when create new round successfully", () => {
            it("should publish round result to client", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(roundResultPublisher.publishRoundResult).toHaveBeenCalledWith(collectRoundResult);
            });

            it("should increase roundId", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(gameData.roundId).toBe(createRoundResult.id + 1);
            });

            it("should call settle bets", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(consumer.settleBets).toHaveBeenCalledWith({
                    settlementResult,
                    result,
                    roundId: createRoundResult.id,
                    time: createRoundResult.time,
                });
            });

            it("should publish winning player to client", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(roundResultPublisher.publishWinners).toHaveBeenCalledWith(roundId, gameData.winningPlayers);
            });
        });

        describe("when failed to create new round", () => {
            beforeEach(() => {
                roundsRepository.create.mockRestore();
                roundsRepository.create.mockReturnValueOnce(undefined);
            });

            it("should not increase roundId", async () => {
                // Arrange
                const currentRoundId = 1;
                gameData.roundId = currentRoundId;

                // Act
                await consumer.settleRound();

                // Assert
                expect(gameData.roundId).toBe(currentRoundId);
            });

            it("should not call settle bets", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(consumer.settleBets).not.toHaveBeenCalled();
            });
        });
    });

    describe("settleBets", () => {
        const result = { red1: true, red2: true, red3: true, red4: false };
        const settlementResult = { odd: true, even: false };
        const queryBets = [
            { uid: chance.guid(), odd: chance.natural(), playerId: chance.natural(), siteId: chance.natural(), save: jest.fn() },
            {
                uid: chance.guid(),
                even: chance.natural(),
                playerId: chance.natural(),
                siteId: chance.natural(),
                freeBet: true,
                save: jest.fn(),
            },
        ];

        const queryBetsHavingOdds = [
            {
                uid: chance.guid(),
                even: chance.natural(),
                playerId: chance.natural(),
                siteId: chance.natural(),
                odds: { odd: 1.9, even: 1.9, red3: 3.7, red4: 14, white3: 3.7, white4: 14 },
                freeBet: true,
                save: jest.fn(),
            },
            {
                uid: chance.guid(),
                even: chance.natural(),
                playerId: chance.natural(),
                siteId: chance.natural(),
                odds: { odd: 1.7, even: 1.7, red3: 3, red4: 12, white3: 3.5, white4: 12 },
                freeBet: true,
                save: jest.fn(),
            },
        ];
        const betResult = {
            totalBetAmount: chance.natural(),
            totalWin: chance.natural(),
            netWin: chance.natural(),
            totalLost: chance.natural(),
            winningByChoices: {},
        };

        const settleBetParams = { result, settlementResult, roundId, time: new Date() };

        beforeEach(() => {
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });
            consumer.callEndGame = jest.fn();
            consumer.calculateBetResult = jest.fn(() => betResult);
            consumer.captureBetResult = jest.fn();
            consumer.queryBets = jest.fn();
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should call queryBets", async () => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(consumer.queryBets).toBeCalledWith(settleBetParams.roundId);
        });

        describe("when bets not having odds", () => {
            beforeEach(() => {
                consumer.queryBets = jest.fn(() => queryBets);
            });

            Object.keys(queryBets)
                .map((index) => +index)
                .forEach((betIndex) => {
                    describe(`with bet ${betIndex + 1}`, () => {
                        it("should call calculateBetResult with odds from gameConfigs", async () => {
                            // Act
                            await consumer.settleBets(settleBetParams);

                            // Assert
                            expect(consumer.calculateBetResult).toHaveBeenNthCalledWith(
                                betIndex + 1,
                                settlementResult,
                                queryBets[betIndex],
                                defaultGameData.gameConfigs.odds
                            );
                        });

                        it("should call endGame", async () => {
                            // Arrange
                            const metaData = {
                                settlementResult,
                            };
                            consumer.createMetadata = jest.fn(() => metaData);

                            // Act
                            await consumer.settleBets(settleBetParams);

                            // Assert
                            expect(consumer.callEndGame).toHaveBeenNthCalledWith(
                                betIndex + 1,
                                queryBets[betIndex],
                                settleBetParams.roundId,
                                settleBetParams.time,
                                betResult,
                                metaData
                            );
                        });

                        it("should call captureBetResult", async () => {
                            // Act
                            await consumer.settleBets(settleBetParams);

                            // Assert
                            expect(consumer.captureBetResult).toHaveBeenNthCalledWith(
                                betIndex + 1,
                                queryBets[betIndex].uid,
                                betResult,
                                queryBets[betIndex].rate
                            );
                        });

                        it("should publish bet result to user", async () => {
                            // Act
                            await consumer.settleBets(settleBetParams);

                            // Assert
                            expect(userBetResultPublisher.publish).toHaveBeenNthCalledWith(
                                betIndex + 1,
                                queryBets[betIndex].uid,
                                betResult
                            );
                        });
                    });
                });
        });

        describe("when bets having odds", () => {
            beforeEach(() => {
                consumer.queryBets = jest.fn(() => queryBetsHavingOdds);
            });

            Object.keys(queryBetsHavingOdds)
                .map((index) => +index)
                .forEach((betIndex) => {
                    describe(`with bet ${betIndex + 1}`, () => {
                        it("should call calculateBetResult with bet odds", async () => {
                            // Act
                            await consumer.settleBets(settleBetParams);

                            // Assert
                            expect(consumer.calculateBetResult).toHaveBeenNthCalledWith(
                                betIndex + 1,
                                settlementResult,
                                queryBetsHavingOdds[betIndex],
                                queryBetsHavingOdds[betIndex].odds
                            );
                        });
                    });
                });
        });
    });

    describe("callEndGame", () => {
        const bet = {
            uid: chance.guid(),
        };
        const metaData = {
            settlementResult: { red: 10 },
        };

        describe("when api result is ok", () => {
            beforeEach(() => {
                endGame.mockReturnValueOnce({ isOk: true });
            });

            it("should call endGameAPI with correct params", async () => {
                // Arrange
                const gameInfo = {
                    gameId: definition.id,
                    gameRoundId: roundId,
                    siteId: bet.siteId,
                    time: new Date(),
                    operatorId: bet.operatorId,
                    playerId: bet.playerId,
                };
                const settlementInfo = {
                    red: 10,
                };
                consumer.formatEndGameInfo = jest.fn(() => ({ gameInfo, settlementInfo }));

                // Act
                await consumer.callEndGame(bet, roundId, new Date(), { totalWin: 10 }, metaData);

                // Assert
                expect(endGame).toHaveBeenCalledWith(bet.uid, gameInfo, settlementInfo, metaData);
            });
            it("should update balance when total win > 0", async () => {
                // Act
                await consumer.callEndGame(bet, roundId, new Date(), { totalWin: 10 }, metaData);

                // Assert
                expect(consumer.gameManagementApiClient.users.updateBalance).toHaveBeenCalledWith({ id: bet.uid, deductionAmount: -10 });
            });

            it("should not publish api error", async () => {
                // Act
                await consumer.callEndGame(bet, roundId, new Date(), {}, metaData);

                // Assert
                expect(userBetResultPublisher.publishApiError).not.toHaveBeenCalled();
            });
        });

        describe("when api result is failed", () => {
            it("should publish api error", async () => {
                // Arrange
                const apiResult = { isOk: false, response: { errorCode: "500" } };
                endGame.mockReturnValueOnce(apiResult);

                // Act
                await consumer.callEndGame(bet, roundId, new Date(), {}, metaData);

                // Assert
                expect(userBetResultPublisher.publishApiError).toHaveBeenCalledWith(bet.uid, apiResult.response);
            });
        });
    });

    describe("queryBets", () => {
        const queryRoundId = chance.natural();

        it("should call betsRepository find with correct roundId", () => {
            // Act
            consumer.queryBets(queryRoundId);

            // Assert
            expect(betsRepository.find).toHaveBeenCalledWith({ roundId: queryRoundId });
        });

        it("should return value from betsRepository find query", async () => {
            // Arrange
            const queryResult = [
                { uid: chance.guid(), odd: chance.natural(), playerId: chance.natural(), siteId: chance.natural(), save: jest.fn() },
            ];
            betsRepository.find().exec.mockResolvedValue(queryResult);

            // Act
            const actualResult = await consumer.queryBets(queryRoundId);

            // Assert
            expect(actualResult).toStrictEqual(queryResult);
        });
    });

    describe("formatEndGameInfo", () => {
        const time = new Date();

        it("should return result with correct gameInfo", () => {
            // Arrange
            const bet = { freeBet: false, playerId: chance.guid(), operatorId: chance.string(), siteId: chance.guid() };
            const betResult = {
                totalBetAmount: 2000,
                totalWin: 3000,
                netWin: 1000,
                totalLost: 0,
            };

            // Act
            const actualResult = consumer.formatEndGameInfo(bet, roundId, time, betResult);

            // Assert
            expect(actualResult.gameInfo).toStrictEqual({
                gameId: definition.id,
                gameRoundId: roundId,
                siteId: bet.siteId,
                time: time,
                operatorId: bet.operatorId,
                playerId: bet.playerId,
            });
        });

        describe("when total win is greater than zero", () => {
            it("should return settlementInfo with correct red", () => {
                // Arrange
                const bet = { freeBet: true };
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 3000,
                    netWin: 1000,
                    totalLost: 0,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo(bet, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.red).toBe(betResult.totalWin);
            });
        });

        describe("when total win is not greater than zero", () => {
            it("should return settlementInfo with undefined red", () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 0,
                    netWin: 1000,
                    totalLost: 0,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo({}, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.red).toBeUndefined();
            });
        });
    });

    describe("calculateBetResult", () => {
        const settlementResult = { odd: true, even: false, red3: true, red4: false, white3: false, white4: false };
        const odds = defaultGameData.gameConfigs.odds;

        it("should return totalWin amount with format #.##", () => {
            // Arrange
            const bet = { odd: 0.05 };

            // Act
            const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

            // Assert
            expect(actualResult.totalWin.toString().split(".")[0].length).toBeLessThanOrEqual(2);
        });

        it("should return netWin amount with format #.##", () => {
            // Arrange
            const bet = { odd: 0.05 };

            // Act
            const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

            // Assert
            expect(actualResult.netWin.toString().split(".")[0].length).toBeLessThanOrEqual(2);
        });

        describe("when bet is free bet", () => {
            it("should return result with winning amount exclude bet amount", () => {
                // Arrange
                const choice = "odd";
                const bet = { freeBet: true, [choice]: 1000 };

                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalWin).toBe(960);
            });
        });

        describe("when bet result is win", () => {
            const bet = { odd: 1000, red3: 100, white4: 100 };

            it("should return result with correct net win", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.netWin).toBe(1235);
            });

            it("should return with correct total bet amount", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalBetAmount).toBe(1200);
            });

            it("should return result with total win includes net win and total bet", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalWin).toBe(2335);
            });

            it("should return result with correct total lost", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalLost).toBe(100);
            });

            it("should return correct choice winning", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.winningByChoices).toStrictEqual({ odd: 1960, even: 0, red3: 375, red4: 0, white3: 0, white4: 0 });
            });
        });

        describe("when bet result is lose", () => {
            const bet = { even: 500, red4: 50, white3: 50, white4: 50 };

            it("should return result with net win is 0", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.netWin).toBe(0);
            });

            it("should return result with total win is 0", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalWin).toBe(0);
            });

            it("should return result with total lost is bet amount", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalLost).toBe(650);
            });

            it("should return correct choice winning", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.winningByChoices).toStrictEqual({ even: 0, odd: 0, red3: 0, red4: 0, white3: 0, white4: 0 });
            });
        });
    });
});
