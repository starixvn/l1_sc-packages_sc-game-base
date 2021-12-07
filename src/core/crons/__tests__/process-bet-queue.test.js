import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import noticeHelper from "sc-common/helpers/notice-helper";
import logger from "sc-common/logger";

import BaseMetrics from "../../base-metrics";
import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import ProcessBetQueue from "../process-bet-queue";

jest.mock("../../event-publishers/place-bet-publisher");

const gameData = new GameData(10);
gameData.exchangeRates = {
    exId: 1,
    code: {
        USD: 1,
        VND: 0.00004405,
        IDR: 0.07099,
    },
};

gameData.gameConfigs = {
    odds: {
        red2: 2.4,
    },
};

const definition = new GameDefinition({
    id: 1,
    name: "game name",
    durations: { lockingBet: 5, wholeRound: 30, placingBets: 25 },
    choicesMapper: { red2: 1 },
});
const placeBetPublisher = new PlaceBetPublisher(definition.name, gameData);
/** @type {logger}*/
const logService = stub(logger);
/** @type {mongoose.Model}*/
const betsRepository = stubMongooseModelStupidly(mongoose.Model);
betsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongooseModelStupidly(mongoose.Model);
betLogsRepository.create = jest.fn();

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
userInfosRepository.updateOne = jest.fn();

const baseMetrics = stub(BaseMetrics);

beforeEach(() => {
    gameData.ingame = {
        player01: {
            name: "player01",
            betTracks: { red2: 100 },
            betQueue: [
                {
                    player: {},
                    payload: {},
                },
            ],
        },
    };
});

describe("dequeueBets tests", () => {
    it("get data from inGame, pop item from betQueue, then proceed", () => {
        // arange
        const placeBet = jest.fn();
        const proceedBetQueue = initBetQueue(placeBet);
        proceedBetQueue.proceedBet = jest.fn().mockResolvedValueOnce({});

        // act
        proceedBetQueue.dequeueBets();

        // assert
        expect(proceedBetQueue.proceedBet).toHaveBeenCalled();
    });
});

describe("proceed freeBet", () => {
    it("should call handleFailedBet with notEnoughScoin when insufficient coins", async () => {
        // arange
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce({
            scoins: 0,
        });

        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload(1, true));

        // assert
        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            notice: { errorCode: noticeHelper.notEnoughScoin },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

describe("proceedBet in blocking time tests", () => {
    it("dequeue bet in blocking time, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        // arange
        gameData.remainingTime = 3;
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            notice: { errorCode: noticeHelper.placeBetNextRound },
        });
    });

    it("dequeue bet of settled round, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        // arange
        gameData.roundId = 2;
        gameData.remainingTime = 10;
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            notice: { errorCode: noticeHelper.placeBetNextRound },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

describe("proceedBet placebet error tests", () => {
    beforeEach(() => {
        gameData.remainingTime = 10;
        gameData.roundId = 1;
    });

    it("place bet api return apiError, should call handleFailedBet, placeBetPublisher.publishGameFailedBet and update user stake level", async () => {
        // arange
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError: {
                    minBet: 1,
                    maxBet: 3000,
                },
            },
        });
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(userInfosRepository.updateOne).toHaveBeenCalled();
        expect(player.profile.minBet).toEqual(1);
        expect(player.profile.maxBet).toEqual(3000);
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            apiError: {
                minBet: 1,
                maxBet: 3000,
            },
        });
    });

    it("placeBet api return winLimitHit error, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        // arange
        const apiError = {
            message: "Win limit hit! Please contact your upline, thank you",
        };
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError,
            },
        });
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, { endBet: -1, betChoice: "red2", apiError });
    });

    it("placeBet api return winLimitHit error, should decrease bet tracks", async () => {
        // arange
        const apiError = {
            message: "Win limit hit! Please contact your upline, thank you",
        };
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError,
            },
        });
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(gameData.ingame.player01.betTracks["red2"]).toBe(0);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

describe("proceedBet successful tests", () => {
    beforeEach(() => {
        gameData.remainingTime = 10;
        gameData.roundId = 1;
    });

    it("place bet successfully, insert new betlog, upsert bet, update total bet and call notifyPlacingBetResult", async () => {
        // arange
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });
        const proceedBetQueue = initBetQueue(placeBet);
        const player = mockPlayer();

        // act
        await proceedBetQueue.proceedBet(player, mockPayload());

        // assert
        expect(betLogsRepository.create).toHaveBeenCalled();
        expect(betsRepository.updateOne).toHaveBeenCalled();
        expect(placeBetPublisher.publishSuccessBet).toHaveBeenCalled();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

const initBetQueue = (placeBet) => {
    return new ProcessBetQueue({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        baseMetrics,
    });
};

const mockPlayer = () => {
    return {
        UID: 1,
        profile: { name: "player01", minBet: 1, maxBet: 5000 },
        session: {
            userId: 1,
            memberId: 1,
            siteId: "123456",
            currencyCode: "USD",
            multiplier: 1000,
        },
        socketClient: {
            emit: jest.fn(),
        },
    };
};

const mockPayload = (roundId = 1, freeBet = false) => {
    return {
        freeBet,
        amount: 100,
        betChoice: "red2",
        roundId,
        receivedTime: new Date(),
    };
};
