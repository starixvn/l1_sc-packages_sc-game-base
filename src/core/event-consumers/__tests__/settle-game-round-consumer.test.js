import { stubMongoose, stub } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RoundResultPublisher from "../../event-publishers/round-result-publisher";
import UserBetResultPublisher from "../../event-publishers/user-bet-result-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import SettleGameRoundConsumer from "../settle-game-round-consumer";
import Chance from "chance";
import { Models } from "jest-auto-fixture";

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new GameData(30);
    defaultGameData.gameConfigs = Models.GameConfig({ odds: { odd: 1.96, even: 1.96 } });

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
        const createRoundResult = { id: 1, result, settlementResult, time: mockDate };

        beforeEach(() => {
            gameData.result = { red1: true, red2: true, red3: true, red4: false };
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            consumer.settleBets = jest.fn();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
            roundsRepository.create.mockReturnValueOnce(createRoundResult);
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
                id: 1,
                result,
                settlementResult,
                time: mockDate,
            });
        });

        describe("when create new round successfully", () => {
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
            { uid: chance.guid(), odd: chance.natural(), memberId: chance.natural(), siteId: chance.natural(), save: jest.fn() },
            {
                uid: chance.guid(),
                even: chance.natural(),
                memberId: chance.natural(),
                siteId: chance.natural(),
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
        const collectRoundResult = {
            result,
            settlementResult,
            roundId,
        };
        const settleBetParams = { result, settlementResult, roundId, time: new Date() };

        beforeEach(() => {
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });
            consumer.callEndGame = jest.fn();
            consumer.queryBets = jest.fn(() => queryBets);
            consumer.calculateBetResult = jest.fn(() => betResult);
            consumer.collectRoundResult = jest.fn(() => collectRoundResult);
        });

        it("should call end game with all bet", async () => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(consumer.callEndGame).toHaveBeenCalledTimes(queryBets.length);
        });

        test.each(Object.keys(queryBets).map((index) => [+index]))("should  publish to user bet result", async (betIndex) => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(userBetResultPublisher.publish).toHaveBeenNthCalledWith(betIndex + 1, queryBets[betIndex].uid, betResult);
        });

        it("should publish round result to client", async () => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(roundResultPublisher.publishRoundResult).toHaveBeenCalledWith(collectRoundResult);
        });
    });

    describe("callEndGame", () => {
        const bet = {
            uid: chance.guid(),
        };

        describe("when api result is ok", () => {
            it("should not publish api error", async () => {
                // Arrange
                endGame.mockReturnValueOnce({ isOk: true, response: {} });

                // Act
                await consumer.callEndGame(bet, roundId, new Date(), {});

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
                await consumer.callEndGame(bet, roundId, new Date(), {});

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
            expect(betsRepository.find).toHaveBeenCalledWith({ phien: queryRoundId });
        });

        it("should return value from betsRepository find query", async () => {
            // Arrange
            const queryResult = [
                { uid: chance.guid(), odd: chance.natural(), memberId: chance.natural(), siteId: chance.natural(), save: jest.fn() },
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
            const bet = { freeBet: false, memberId: chance.guid(), partnerId: chance.string(), siteId: chance.guid() };
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
                memberId: bet.memberId,
                siteId: bet.siteId,
                partnerId: bet.partnerId,
                time: time,
                operatorId: bet.partnerId,
                playerId: bet.memberId,
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

        describe("when net win is greater than zero", () => {
            it("should return settlementInfo with correct redWin", () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 3000,
                    netWin: 1000,
                    totalLost: 0,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo({}, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.redWin).toBe(betResult.netWin);
            });
        });

        describe("when net win is not greater than zero", () => {
            it("should return settlementInfo with undefined redWin", () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 0,
                    netWin: 0,
                    totalLost: 2000,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo({}, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.redWin).toBeUndefined();
            });
        });

        describe("when total lost is greater than zero", () => {
            it("should return settlementInfo with correct redLost", () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 0,
                    netWin: 0,
                    totalLost: 2000,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo({}, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.redLost).toBe(betResult.totalLost);
            });
        });

        describe("when total lost is not greater than zero", () => {
            it("should return settlementInfo with undefined redLost", () => {
                // Arrange
                const betResult = {
                    totalBetAmount: 2000,
                    totalWin: 3500,
                    netWin: 1500,
                    totalLost: 0,
                };

                // Act
                const actualResult = consumer.formatEndGameInfo({}, roundId, time, betResult);

                // Assert
                expect(actualResult.settlementInfo.redLost).toBeUndefined();
            });
        });
    });

    describe("calculateBetResult", () => {
        const settlementResult = { odd: true, even: false };
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
            const choice = "odd";
            const bet = { [choice]: 1000 };

            it("should return result with correct net win", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.netWin).toBe(960);
            });

            it("should return with correct total bet amount", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalBetAmount).toBe(1000);
            });

            it("should return result with total win includes net win and total bet", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalWin).toBe(1960);
            });

            it("should return result with total lost is zero", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.totalLost).toBe(0);
            });

            it("should return correct choice winning", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.winningByChoices).toStrictEqual({ odd: 1960, even: 0 });
            });
        });

        describe("when bet result is lose", () => {
            const bet = { even: 500 };

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
                expect(actualResult.totalLost).toBe(500);
            });

            it("should return correct choice winning", () => {
                // Act
                const actualResult = consumer.calculateBetResult(settlementResult, bet, odds);

                // Assert
                expect(actualResult.winningByChoices).toStrictEqual({ even: 0, odd: 0 });
            });
        });
    });
});
