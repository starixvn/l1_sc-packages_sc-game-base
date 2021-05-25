import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import noticeHelper from "sc-common/helpers/notice-helper";
import logger from "sc-common/logger";

import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import ProcessBetQueue from "../process-bet-queue";

jest.mock("../../event-publishers/place-bet-publisher");

const gameData = new GameData(3);
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
const placeBet = jest.fn();
const validateBalance = jest.fn();
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

describe("dequeueBets tests", () => {
    it("get data from inGame, pop item from betQueue, then proceed", () => {
        gameData.ingame = {
            player01: {
                name: "player01",
                betTracks: {},
                betQueue: [
                    {
                        player: {},
                        payload: {},
                    },
                ],
            },
        };

        const proceedBetQueue = new ProcessBetQueue({
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

        proceedBetQueue.proceedBet = jest.fn().mockResolvedValueOnce({});

        proceedBetQueue.dequeueBets();

        expect(proceedBetQueue.proceedBet).toHaveBeenCalled();
    });
});

describe("proceedBet tests", () => {
    gameData.ingame = {
        player01: {
            name: "player01",
            betTracks: { red2: 100 },
            betQueue: [],
        },
    };
    gameData.roundId = 1;
    gameData.remainingTime = 10;
    const player = {
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

    const payload = {
        freeBet: false,
        amount: 100,
        betChoice: "red2",
        roundId: 1,
    };

    it("place bet successfully, insert new betlog, upsert bet, update total bet and call notifyPlacingBetResult", async () => {
        const proceedBetQueue = new ProcessBetQueue({
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
        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        placeBet.mockReturnValueOnce({ isOk: true, response: {} });

        await proceedBetQueue.proceedBet(player, payload);

        expect(betLogsRepository.create).toHaveBeenCalled();
        expect(betsRepository.updateOne).toHaveBeenCalled();
        expect(placeBetPublisher.publishSuccessBet).toHaveBeenCalled();
    });

    it("place bet api return apiError, should call handleFailedBet, placeBetPublisher.publishGameFailedBet and update user stake level", async () => {
        const proceedBetQueue = new ProcessBetQueue({
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
        const placeBetResponse = {
            isOk: false,
            response: {
                apiError: {
                    minBet: 1,
                    maxBet: 3000,
                },
            },
        };

        validateBalance.mockReturnValueOnce({ isOk: true, response: {} });
        placeBet.mockReturnValueOnce(placeBetResponse);

        await proceedBetQueue.proceedBet(player, payload);

        expect(userInfosRepository.updateOne).toHaveBeenCalled();
        expect(player.profile.minBet).toEqual(1);
        expect(player.profile.maxBet).toEqual(3000);
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            apiError: placeBetResponse.response.apiError,
        });
    });

    it("validateBalance api return insufficientBalance, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        const proceedBetQueue = new ProcessBetQueue({
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

        const balanceResponse = {
            isOk: false,
            response: {
                inSufficientBalance: true,
            },
        };
        placeBet.mockReturnValueOnce({});
        validateBalance.mockReturnValueOnce(balanceResponse);

        await proceedBetQueue.proceedBet(player, payload);

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, {
            endBet: -1,
            betChoice: "red2",
            notice: noticeHelper.notEnoughMoney,
        });
    });

    it("validateBalance api return kickedOut, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        const proceedBetQueue = new ProcessBetQueue({
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
        const balanceResponse = {
            isOk: false,
            response: {
                kickedOut: true,
            },
        };
        placeBet.mockReturnValueOnce({});
        validateBalance.mockReturnValueOnce(balanceResponse);

        await proceedBetQueue.proceedBet(player, payload);

        expect(placeBet).not.toHaveBeenCalled();
        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, { endBet: -1, betChoice: "red2", kickedOut: true });
    });

    it("placeBet api return winLimitHit error, should call handleFailedBet, placeBetPublisher.publishGameFailedBet", async () => {
        const placeBetError = jest.fn();
        const proceedBetQueue = new ProcessBetQueue({
            definition,
            gameData,
            placeBetPublisher,
            placeBet: placeBetError,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            validateBalance,
        });
        const apiError = {
            message: "Win limit hit! Please contact your upline, thank you",
        };
        const placeBetResponse = {
            isOk: false,
            response: {
                apiError,
            },
        };
        validateBalance.mockReturnValueOnce({
            isOk: true,
            response: {},
        });
        placeBetError.mockReturnValueOnce(placeBetResponse);

        await proceedBetQueue.proceedBet(player, payload);

        expect(userInfosRepository.updateOne).not.toHaveBeenCalled();
        expect(placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(player.UID, { endBet: -1, betChoice: "red2", apiError });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
