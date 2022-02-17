import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
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

gameData.currencies = [
    { code: "USD", isTest: false, isUncountOnTotal: false },
    { code: "IND", isTest: true, isUncountOnTotal: false },
    { code: "UUS", isTest: true, isUncountOnTotal: true },
];

const chance = new Chance();
const definition = new GameDefinition({
    id: 1,
    name: "game name",
    durations: {
        wholeRound: 36,
        placingBets: 30,
        lockingBet: 5,
        shakeThePlateDuration: 1,
    },
    choicesMapper: { red2: 1 },
});
const placeBetPublisher = new PlaceBetPublisher(definition.name, gameData);
/** @type {logger}*/
const logService = stub(logger);
/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);
betsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);
betLogsRepository.create = jest.fn();

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongoose(mongoose.Model);
userInfosRepository.updateOne = jest.fn();

const baseMetrics = stub(BaseMetrics);
let player = null,
    proceedBetQueue = null,
    payload = null,
    placeBet = null;

beforeEach(() => {
    player = mockPlayer();
    placeBet = jest.fn();
    payload = mockPayload();
    proceedBetQueue = initBetQueue(placeBet);

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
        placeBet.mockReturnValueOnce({});
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce({
            scoins: 0,
        });

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

describe("proceedBet should reject when dequeue in locking bet duration", () => {
    it("after locking bet time", async () => {
        // arange
        gameData.remainingTime = definition.durations.lockingBet - 1;
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });

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

    it("at locking bet time", async () => {
        // arange
        gameData.remainingTime = definition.durations.lockingBet;
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });

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
        placeBet.mockReturnValueOnce({});

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
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError: {
                    minBet: 1,
                    maxBet: 3000,
                },
            },
        });

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
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError,
            },
        });

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
        placeBet.mockReturnValueOnce({
            isOk: false,
            response: {
                apiError,
            },
        });

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
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });

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

describe("handleSuccessBet", () => {
    const response = {};
    const roundId = chance.natural();

    it("should call calculateCurrencyRate", async () => {
        // Arrange
        jest.spyOn(proceedBetQueue, "calculateCurrencyRate");

        // Act
        await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

        // Assert
        expect(proceedBetQueue.calculateCurrencyRate).toBeCalled();
    });

    it("should call upsertBet", async () => {
        // Arrange
        jest.spyOn(proceedBetQueue, "upsertBet");

        // Act
        await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

        // Assert
        expect(proceedBetQueue.upsertBet).toBeCalled();
    });

    it("should call isCountOnTotalBets", async () => {
        // Arrange
        jest.spyOn(proceedBetQueue, "isCountOnTotalBets");

        // Act
        await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

        // Assert
        expect(proceedBetQueue.isCountOnTotalBets).toBeCalled();
    });

    it("should call notifyPlacingBetResult", async () => {
        // Arrange
        jest.spyOn(proceedBetQueue, "notifyPlacingBetResult");

        // Act
        await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

        // Assert
        expect(proceedBetQueue.notifyPlacingBetResult).toBeCalled();
    });

    describe("when betLogsRepository is available", () => {
        it("should call insertBetLog", async () => {
            //Arrange
            jest.spyOn(proceedBetQueue, "insertBetLog");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.insertBetLog).toBeCalled();
        });
    });

    describe("when betLogsRepository is not available", () => {
        it("should not call insertBetLog", async () => {
            //Arrange
            proceedBetQueue.betLogsRepository = undefined;
            jest.spyOn(proceedBetQueue, "insertBetLog");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.insertBetLog).not.toBeCalled();
        });
    });

    describe("when player currency is allow to count on total bets", () => {
        it("should call adjustTotalBets", async () => {
            // Arrange
            proceedBetQueue.isCountOnTotalBets = jest.fn().mockReturnValueOnce(true);
            jest.spyOn(proceedBetQueue, "adjustTotalBets");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.adjustTotalBets).toBeCalled();
        });
    });

    describe("when player currency is not allow to count on total bets", () => {
        it("should call not call adjustTotalBets", async () => {
            // Arrange
            proceedBetQueue.isCountOnTotalBets = jest.fn().mockReturnValueOnce(false);
            jest.spyOn(proceedBetQueue, "adjustTotalBets");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.adjustTotalBets).not.toBeCalled();
        });
    });

    describe("when bet is free bet", () => {
        it("should not call updateUserStakeLevel", async () => {
            // Arrange
            payload.freeBet = true;
            jest.spyOn(proceedBetQueue, "updateUserStakeLevel");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
        });
    });

    describe("when bet is not free bet and user stake level is not updated", () => {
        it("should not call updateUserStakeLevel", async () => {
            // Arrange
            payload.freeBet = false;
            response.minBet = player.profile.minBet;
            response.maxBet = player.profile.maxBet;
            jest.spyOn(proceedBetQueue, "updateUserStakeLevel");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
        });
    });

    describe("when bet is not free bet and user stake level is updated", () => {
        it("should call updateUserStakeLevel", async () => {
            // Arrange
            payload.freeBet = false;
            response.minBet = player.profile.minBet + 1;
            response.maxBet = player.profile.maxBet;
            jest.spyOn(proceedBetQueue, "updateUserStakeLevel");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.updateUserStakeLevel).toBeCalledWith(player, response.minBet, response.maxBet);
        });
    });
});

describe("isCountOnTotalBets", () => {
    describe("when player currency is not test currency", () => {
        it("should return true", () => {
            // Arrange
            player.session.currencyCode = "USD";

            // Act
            const actualResult = proceedBetQueue.isCountOnTotalBets(player);

            // Assert
            expect(actualResult).toBe(true);
        });
    });

    describe("when player currency is test currency and isUncountOnTotal config is false", () => {
        it("should return true", () => {
            // Arrange
            player.session.currencyCode = "IND";

            // Act
            const actualResult = proceedBetQueue.isCountOnTotalBets(player);

            // Assert
            expect(actualResult).toBe(true);
        });
    });

    describe("when player currency is test currency and isUncountOnTotal config is true", () => {
        it("should return false", () => {
            // Arrange
            player.session.currencyCode = "UUS";

            // Act
            const actualResult = proceedBetQueue.isCountOnTotalBets(player);

            // Assert
            expect(actualResult).toBe(false);
        });
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
