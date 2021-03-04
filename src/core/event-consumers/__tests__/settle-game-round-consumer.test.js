import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import RoundResultPublisher from "../../event-publishers/round-result-publisher";
import UserBetResultPublisher from "../../event-publishers/user-bet-result-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import SettleGameRoundConsumer from "../settle-game-round-consumer";

jest.mock("../../event-publishers/user-bet-result-publisher");
jest.mock("../../event-publishers/round-result-publisher");

const definition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
const gameData = new GameData(30);
gameData.gameConfigs = {
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

const roundResultPublisher = new RoundResultPublisher();

const userBetResultPublisher = new UserBetResultPublisher();

const endGame = jest.fn();

/** @type {mongoose.Model}*/
const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

/** @type {mongoose.Model}*/
const betsRepository = stubMongooseModelStupidly(mongoose.Model);

describe("generateResult test", () => {
    it("should return restult from admin when roundId from gameData is equal to roundId from admin", () => {
        gameData.settlementResultFromAdmin = {
            roundId: 1,
            result: { red1: true, red2: false, red3: true, red4: false },
        };
        gameData.roundId = 1;
        definition.generateResult.mockReturnValueOnce({ red1: true, red2: true, red3: true, red4: false });

        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        var actualResult = consumer.generateResult();
        expect(actualResult).toEqual(gameData.settlementResultFromAdmin.result);
    });

    it("should return restult from generation when roundId from gameData is diferrent from roundId from admin", () => {
        gameData.settlementResultFromAdmin = {
            roundId: 1,
            result: { red1: true, red2: false, red3: true, red4: false },
        };
        gameData.roundId = 2;
        definition.generateResult.mockReturnValueOnce({ red1: true, red2: true, red3: true, red4: false });

        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        var actualResult = consumer.generateResult();
        expect(actualResult).toEqual({ red1: true, red2: true, red3: true, red4: false });
    });
});

describe("settleRound test", () => {
    it("should create new round and call settle bet", async () => {
        const result = { red1: true, red2: true, red3: true, red4: false };
        const settlementResult = { odd: true, even: false };

        definition.generateResult.mockReturnValueOnce(result);
        definition.settle.mockReturnValueOnce(settlementResult);
        roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });

        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });
        consumer.settleBets = jest.fn();

        await consumer.settleRound();

        expect(roundsRepository.create).toHaveBeenCalled();
        expect(consumer.settleBets).toHaveBeenCalled();
    });
});

describe("settleBets test", () => {
    it("should settle all bets and publish to game client", async () => {
        const result = { red1: true, red2: true, red3: true, red4: false };
        const settlementResult = { odd: true, even: false };

        definition.generateResult.mockReturnValueOnce(result);
        definition.settle.mockReturnValueOnce(settlementResult);
        roundsRepository.create.mockReturnValueOnce({ id: 1, result, settlementResult });

        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });
        consumer.callEndGame = jest.fn();
        consumer.queryBets = jest.fn(() => [
            { odd: 100, save: jest.fn() },
            { even: 200, freeBet: true, save: jest.fn() },
        ]);

        await consumer.settleBets({ result, settlementResult, roundId: 1, time: new Date() });

        expect(consumer.callEndGame).toHaveBeenCalled();
        expect(userBetResultPublisher.publish).toHaveBeenCalled();
        expect(roundResultPublisher.publishRoundResult).toHaveBeenCalled();
    });
});

describe("callEndGame test", () => {
    it("should not publish to game client when api result is ok", async () => {
        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        endGame.mockReturnValue({ isOk: true, response: {} });

        await consumer.callEndGame({ even: 200, freeBet: false, memberId: 1, siteId: 1 }, 1, new Date(), {
            totalBetAmount: 0,
            totalWin: 0,
            netWin: 0,
            totalLost: 0,
            winningByChoices: {},
        });

        expect(userBetResultPublisher.publishApiError).not.toHaveBeenCalled();
    });

    it("should not publish to game client when api result is ok", async () => {
        const consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        endGame.mockReturnValue({ isOk: true, response: {} });

        await consumer.callEndGame({ even: 200, freeBet: false, memberId: 1, siteId: 1 }, 1, new Date(), {
            totalBetAmount: 0,
            totalWin: 400,
            netWin: 200,
            totalLost: 0,
            winningByChoices: {},
        });

        expect(userBetResultPublisher.publishApiError).not.toHaveBeenCalled();
    });
});

afterEach(() => {
    jest.clearAllMocks();
});
