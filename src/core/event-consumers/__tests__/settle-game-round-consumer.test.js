import { stubMongoose, stub } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RoundResultPublisher from "../../event-publishers/round-result-publisher";
import UserBetResultPublisher from "../../event-publishers/user-bet-result-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import SettleGameRoundConsumer from "../settle-game-round-consumer";
import Chance from "chance";

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new GameData(30);
    defaultGameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        choices_maxbet: {
            odd: 1000,
            even: 1000,
        },
        odds: {
            odd: 2,
            even: 2,
        },
        enableFreeBet: false,
    };

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
                expect(actualResult).toEqual(generateResult);
            });
        });
    });

    describe("settleRound", () => {
        const result = { red1: true, red2: true, red3: true, red4: false };
        const settlementResult = { odd: true, even: false };

        beforeEach(() => {
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            consumer.settleBets = jest.fn();
            roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });
        });

        describe("when execute", () => {
            it("should call generateResult", async () => {
                // Act
                await consumer.settleRound();

                // Assert
                expect(consumer.settleBets).toHaveBeenCalledWith({
                    result,
                    settlementResult,
                    roundId: 1,
                });
            });

            it("should create new round", async () => {
                // Arrange
                const mockDate = new Date();
                jest.spyOn(global, "Date").mockImplementation(() => mockDate);

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

        beforeEach(() => {
            definition.generateResult.mockReturnValueOnce(result);
            definition.settle.mockReturnValueOnce(settlementResult);
            roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });
            consumer.callEndGame = jest.fn();
            consumer.queryBets = jest.fn(() => queryBets);
            consumer.calculateBetResult = jest.fn(() => betResult);
            consumer.collectRoundResult = jest.fn(() => collectRoundResult);
        });

        describe("when execute", () => {
            const settleBetParams = { result, settlementResult, roundId, time: new Date() };

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
    });

    describe("callEndGame", () => {
        describe("when api result is ok", () => {
            const bet = {
                uid: chance.guid(),
            };

            it("should not publish api error", async () => {
                // Arrange
                endGame.mockReturnValueOnce({ isOk: true, response: {} });

                // Act
                await consumer.callEndGame(bet, roundId, new Date(), {});

                // Assert
                expect(userBetResultPublisher.publishApiError).not.toHaveBeenCalled();
            });

            it("should not publish api error", async () => {
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
});
