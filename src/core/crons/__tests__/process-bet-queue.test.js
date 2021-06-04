import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import noticeHelper from "sc-common/helpers/notice-helper";
import logger from "sc-common/logger";

import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import ProcessBetQueue from "../process-bet-queue";

jest.mock("../../event-publishers/place-bet-publisher");

const gameData = new GameData(10);
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
        const placeBet = jest.fn();
        const validateBalance = jest.fn();
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);
        proceedBetQueue.proceedBet = jest.fn().mockResolvedValueOnce({});

        proceedBetQueue.dequeueBets();

        expect(proceedBetQueue.proceedBet).toHaveBeenCalled();
    });
});

describe("proceedBet balance error tests", () => {
    it("validateBalance api return insufficientBalance, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({
            isOk: false,
            response: {
                inSufficientBalance: true,
            },
        });

        const proceedBetQueue = initBetQueue(validateBalance, placeBet);
        const player = mockPlayer();

        await proceedBetQueue.proceedBet(player, mockPayload());

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            apiError: { errorCode: noticeHelper.notEnoughMoney },
        });
    });

    it("validateBalance api return insufficientBalance for freeBet, should call handleFailedBet with notEnoughScoin", async () => {
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({
            isOk: false,
            response: {
                inSufficientBalance: true,
            },
        });

        const proceedBetQueue = initBetQueue(validateBalance, placeBet);
        const player = mockPlayer();

        await proceedBetQueue.proceedBet(player, mockPayload(1, true));

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            apiError: { errorCode: noticeHelper.notEnoughScoin },
        });
    });

    it("validateBalance api return kickedOut, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({
            isOk: false,
            response: {
                kickedOut: true,
            },
        });

        const proceedBetQueue = initBetQueue(validateBalance, placeBet);
        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, { endBet: -1, betChoice: "red2", kickedOut: true });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

describe("proceedBet in blocking time tests", () => {
    it("dequeue bet in blocking time, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        gameData.remainingTime = 3;

        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({
            isOk: true,
            response: {},
        });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            notice: { errorCode: noticeHelper.placeBetNextRound },
        });
    });

    it("dequeue bet of settled round, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        gameData.roundId = 2;
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({});

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({
            isOk: true,
            response: {},
        });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

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

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

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

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, { endBet: -1, betChoice: "red2", apiError });
    });

    it("placeBet api return winLimitHit error, should decrease bet tracks", async () => {
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

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

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
        const placeBet = jest.fn();
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });

        const validateBalance = jest.fn();
        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        const proceedBetQueue = initBetQueue(validateBalance, placeBet);

        const player = mockPlayer();
        await proceedBetQueue.proceedBet(player, mockPayload());

        expect(betLogsRepository.create).toHaveBeenCalled();
        expect(betsRepository.updateOne).toHaveBeenCalled();
        expect(placeBetPublisher.publishSuccessBet).toHaveBeenCalled();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

const initBetQueue = (validateBalance, placeBet) => {
    return new ProcessBetQueue({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        validateBalance,
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
    };
};
