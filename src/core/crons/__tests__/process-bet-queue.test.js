import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { cloneDeep } from "lodash";
import mongoose from "mongoose";
import logger from "sc-common/logger";

import BaseMetrics from "../../base-metrics";
import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import ProcessBetQueue from "../process-bet-queue";

describe("ProcessBetQueue", () => {
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
        { code: "USD", name: "USD", isTest: false, isUncountOnTotal: false },
        { code: "IND", name: "IND", isTest: true, isUncountOnTotal: false },
        { code: "VND", name: "UUS", isTest: true, isUncountOnTotal: true },
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
        jest.clearAllMocks();

        const playerInGameData = {
            name: "player01",
            betTracks: { red2: 100 },
            betQueue: [
                {
                    player: {},
                    payload: {},
                },
            ],
        };
        player = mockPlayer();
        placeBet = jest.fn();
        payload = mockPayload();
        proceedBetQueue = initBetQueue(placeBet);

        gameData.ingame = {
            player01: cloneDeep(playerInGameData),
        };
    });

    describe("dequeueBets", () => {
        describe("when gameData.inGame is undefined", () => {
            it("should not call proceedBet", () => {
                // Arrange
                gameData.ingame = undefined;
                jest.spyOn(proceedBetQueue, "proceedBet");

                // Act
                proceedBetQueue.dequeueBets();

                // Assert
                expect(proceedBetQueue.proceedBet).not.toBeCalled();
            });
        });

        describe("when gameData.inGame is empty", () => {
            it("should not call proceedBet", () => {
                // Arrange
                gameData.ingame = {};
                jest.spyOn(proceedBetQueue, "proceedBet");

                // Act
                proceedBetQueue.dequeueBets();

                // Assert
                expect(proceedBetQueue.proceedBet).not.toBeCalled();
            });
        });

        describe("when gameData.inGame is not empty", () => {
            beforeEach(() => {
                jest.spyOn(proceedBetQueue, "proceedBet");
            });

            describe("when playerInGame.betProcessing is true", () => {
                it("should not call proceedBet", () => {
                    // Arrange
                    gameData.ingame.player01.betProcessing = true;

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedBet).not.toBeCalled();
                });
            });

            describe("when playerInGame.betQueue is undefined", () => {
                it("should not call proceedBet", () => {
                    // Arrange
                    gameData.ingame.player01.betQueue = undefined;

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedBet).not.toBeCalled();
                });
            });

            describe("when playerInGame.betQueue is empty", () => {
                it("should not call proceedBet", () => {
                    // Arrange
                    gameData.ingame.player01.betQueue = [];

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedBet).not.toBeCalled();
                });
            });

            describe("when playerInGame.betProcessing is false and betQueue is not empty", () => {
                it("should call proceedBet", () => {
                    // Arrange
                    proceedBetQueue.proceedBet = jest.fn().mockResolvedValueOnce({});

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(proceedBetQueue.proceedBet).toBeCalledWith({}, {});
                });

                it("should update layerInGame.processingBet to true", () => {
                    // Arrange
                    proceedBetQueue.proceedBet = jest.fn().mockResolvedValueOnce({});

                    // Act
                    proceedBetQueue.dequeueBets();

                    // Assert
                    expect(gameData.ingame.player01.betProcessing).toBeTrue();
                });
            });
        });
    });

    describe("proceedBet", () => {
        const apiBetInfo = {
            amount: chance.natural(),
            gameId: definition.id,
            gameRoundId: chance.natural(),
            choiceId: chance.natural(),
            freeBet: chance.bool(),
            clientSentTime: new Date(),
        };

        beforeEach(() => {
            jest.clearAllMocks();

            proceedBetQueue.formatApiBetInfo = jest.fn().mockReturnValue({ ...apiBetInfo });
            proceedBetQueue.proceedBetQueue = jest.fn();
            proceedBetQueue.validateBetRequest = jest.fn();
            proceedBetQueue.handleSuccessBet = jest.fn();
            proceedBetQueue.handleFailedBet = jest.fn();
            baseMetrics.collectBetProcessedTime = jest.fn();
        });

        it("should call formatApiBetInfo", async () => {
            // Arrange
            placeBet.mockResolvedValueOnce({ isOk: true });

            // Act
            await proceedBetQueue.proceedBet(player, payload);

            // Assert
            expect(proceedBetQueue.formatApiBetInfo).toBeCalledWith(payload);
        });

        it("should call validateBetRequest", async () => {
            // Arrange
            placeBet.mockResolvedValueOnce({ isOk: true });

            // Act
            await proceedBetQueue.proceedBet(player, payload);

            // Assert
            expect(proceedBetQueue.validateBetRequest).toBeCalledWith(player, payload);
        });

        describe("when request is NOT valid", () => {
            it("should NOT call placeBet", async () => {
                // Arrange
                proceedBetQueue.validateBetRequest.mockReturnValueOnce(false);

                // Act
                await proceedBetQueue.proceedBet(player, payload);

                // Assert
                expect(proceedBetQueue.placeBet).not.toBeCalled();
            });
        });

        describe("when request is valid", () => {
            beforeEach(() => {
                proceedBetQueue.validateBetRequest.mockReturnValueOnce(true);
            });

            it("should call placeBet", async () => {
                // Arrange
                placeBet.mockReturnValueOnce({ isOk: true });

                // Act
                await proceedBetQueue.proceedBet(player, payload);

                // Assert
                expect(proceedBetQueue.placeBet).toBeCalledWith({ id: player.UID, session: player.session }, apiBetInfo);
            });

            it("should call collectBetProcessedTime", async () => {
                // Arrange
                const mockDate = new Date();
                placeBet.mockReturnValueOnce({ isOk: true, response: {} });
                jest.spyOn(global, "Date").mockImplementation(() => mockDate);
                spyOn(baseMetrics, "collectBetProcessedTime");

                // Act
                await proceedBetQueue.proceedBet(player, payload);

                // Assert
                expect(baseMetrics.collectBetProcessedTime).toBeCalledWith((mockDate - payload.receivedTime) / 1000);
            });

            describe("when api result is Ok", () => {
                it("should call handleSuccessBet", async () => {
                    // Arrange
                    placeBet.mockReturnValueOnce({ isOk: true, response: {} });

                    // Act
                    await proceedBetQueue.proceedBet(player, payload);

                    // Assert
                    expect(proceedBetQueue.handleSuccessBet).toBeCalledWith(player, {}, apiBetInfo.gameRoundId, payload);
                });
            });

            describe("when api result is NOT Ok", () => {
                it("should call handleFailedBet", async () => {
                    // Arrange
                    placeBet.mockResolvedValueOnce({ isOk: false, response: {} });

                    // Act
                    await proceedBetQueue.proceedBet(player, payload);

                    // Assert
                    expect(proceedBetQueue.handleFailedBet).toBeCalled();
                });

                describe("when user stake level is NOT updated", () => {
                    it("should NOT call updateUserStakeLevel", async () => {
                        // Arrange
                        jest.spyOn(proceedBetQueue, "updateUserStakeLevel");
                        placeBet.mockResolvedValueOnce({
                            isOk: false,
                            response: {
                                apiError: {
                                    minBet: player.profile.minBet,
                                    maxBet: player.profile.maxBet,
                                },
                            },
                        });

                        // Act
                        await proceedBetQueue.proceedBet(player, payload);

                        // Assert
                        expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
                    });
                });

                describe("when user stake level from API having maxBet is equal 0", () => {
                    it("should NOT call updateUserStakeLevel", async () => {
                        // Arrange
                        jest.spyOn(proceedBetQueue, "updateUserStakeLevel");
                        placeBet.mockResolvedValueOnce({
                            isOk: false,
                            response: {
                                apiError: {
                                    minBet: player.profile.minBet + 10,
                                    maxBet: 0,
                                },
                            },
                        });

                        // Act
                        await proceedBetQueue.proceedBet(player, payload);

                        // Assert
                        expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
                    });
                });

                describe("when user stake level from API having minBet is equal 0", () => {
                    it("should NOT call updateUserStakeLevel", async () => {
                        // Arrange
                        jest.spyOn(proceedBetQueue, "updateUserStakeLevel");
                        placeBet.mockResolvedValueOnce({
                            isOk: false,
                            response: {
                                apiError: {
                                    minBet: 0,
                                    maxBet: player.profile.maxBet + 1000,
                                },
                            },
                        });

                        // Act
                        await proceedBetQueue.proceedBet(player, payload);

                        // Assert
                        expect(proceedBetQueue.updateUserStakeLevel).not.toBeCalled();
                    });
                });

                describe("when user stake level is updated and maxBet, minBet is greater than 0", () => {
                    it("should call updateUserStakeLevel", async () => {
                        // Arrange
                        const apiError = {
                            minBet: player.profile.minBet,
                            maxBet: player.profile.maxBet + 1000,
                        };
                        proceedBetQueue.updateUserStakeLevel = jest.fn();
                        placeBet.mockResolvedValueOnce({
                            isOk: false,
                            response: {
                                apiError,
                            },
                        });

                        // Act
                        await proceedBetQueue.proceedBet(player, payload);

                        // Assert
                        expect(proceedBetQueue.updateUserStakeLevel).toBeCalledWith(player, apiError.minBet, apiError.maxBet);
                    });
                });
            });
        });
    });

    describe("validateBetRequest", () => {
        beforeEach(() => {
            proceedBetQueue.composeValidationCriteria = jest.fn();
        });

        it("should call composeValidationCriteria", async () => {
            // Arrange
            proceedBetQueue.composeValidationCriteria.mockReturnValueOnce([]);

            // Act
            await proceedBetQueue.validateBetRequest(player, payload);

            // Assert
            expect(proceedBetQueue.composeValidationCriteria).toBeCalledWith(player, payload);
        });

        describe("when having any failed criterion", () => {
            it("should call handleFailedBet", async () => {
                // Arrange
                const failedCriterion = { failure: true, notice: "disallow hedge bet" };
                jest.spyOn(proceedBetQueue, "handleFailedBet");
                proceedBetQueue.composeValidationCriteria.mockReturnValueOnce([failedCriterion]);

                // Act
                await proceedBetQueue.validateBetRequest(player, payload);

                // Assert
                expect(proceedBetQueue.handleFailedBet).toBeCalledWith(player, failedCriterion.notice, payload);
            });

            it("should return false", async () => {
                // Arrange
                proceedBetQueue.composeValidationCriteria.mockReturnValueOnce([{ failure: true, notice: "disallow hedge bet" }]);

                // Act
                const actualResult = await proceedBetQueue.validateBetRequest(player, payload);

                // Assert
                expect(actualResult).toBe(false);
            });
        });

        describe("when having NO failed criterion", () => {
            it("should return true", async () => {
                // Arrange
                proceedBetQueue.composeValidationCriteria.mockReturnValueOnce([{ failure: false, notice: "disallow hedge bet" }]);

                // Act
                const actualResult = await proceedBetQueue.validateBetRequest(player, payload);

                // Assert
                expect(actualResult).toBe(true);
            });
        });
    });

    describe("composeValidationCriteria", () => {
        beforeEach(() => {
            proceedBetQueue.composeBalanceValidationCriteria = jest.fn();
            proceedBetQueue.composeBettingTimeValidationCriteria = jest.fn();
        });

        it("should return combine array from results of balance and betting time validation", async () => {
            // Arrange
            const balanceValidationCriteria = [
                {
                    failure: false,
                    notice: "balance validation",
                },
            ];
            const bettingTimeValidationCriteria = [
                {
                    failure: true,
                    notice: "betting time validation",
                },
            ];
            const expectResult = bettingTimeValidationCriteria.concat(balanceValidationCriteria);
            proceedBetQueue.composeBalanceValidationCriteria.mockResolvedValueOnce(balanceValidationCriteria);
            proceedBetQueue.composeBettingTimeValidationCriteria.mockReturnValueOnce(bettingTimeValidationCriteria);

            // Act
            const actualResult = await proceedBetQueue.composeValidationCriteria(player, payload);

            // Assert
            expect(actualResult).toStrictEqual(expectResult);
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        describe("when payload roundId is not current roundId", () => {
            it("should return result with fail criteria place bet next round", () => {
                // Act
                const actualResult = proceedBetQueue.composeBettingTimeValidationCriteria(gameData.roundId + 1);

                // Assert
                expect(actualResult[0].failure).toBe(true);
            });
        });

        describe("when remaining time is less or equal locking bet time", () => {
            it("should return result with fail criteria place bet next round", () => {
                // Arrange
                gameData.remainingTime = definition.durations.lockingBet;

                // Act
                const actualResult = proceedBetQueue.composeBettingTimeValidationCriteria(gameData.roundId);

                // Assert
                expect(actualResult[1].failure).toBe(true);
            });
        });

        describe("when remaining time is greater or equal placing bet time", () => {
            it("should return result with fail criteria place bet next round", () => {
                // Arrange
                gameData.remainingTime = definition.durations.placingBets;

                // Act
                const actualResult = proceedBetQueue.composeBettingTimeValidationCriteria(gameData.roundId + 2);

                // Assert
                expect(actualResult[1].failure).toBe(true);
            });
        });

        describe("when payload roundId is valid and remaining time is valid", () => {
            it("should return result with no failure", () => {
                // Arrange
                gameData.remainingTime = definition.durations.placingBets - 5;

                // Act
                const actualResult = proceedBetQueue.composeBettingTimeValidationCriteria(gameData.roundId);

                // Assert
                expect(actualResult.some((criteria) => criteria.failure)).toBe(false);
            });
        });
    });

    describe("composeBalanceValidationCriteria", () => {
        describe("when bet is free bet", () => {
            beforeEach(() => {
                payload.freeBet = true;
                proceedBetQueue.getCoinBalance = jest.fn();
            });

            it("should call getCoinBalance", async () => {
                // Act
                await proceedBetQueue.composeBalanceValidationCriteria(player, payload);

                // Assert
                expect(proceedBetQueue.getCoinBalance).toBeCalledWith(player);
            });

            describe("when player coins is less than bet amount", () => {
                it("should return result with fail criteria not enough Scoin", async () => {
                    // Arrange
                    proceedBetQueue.getCoinBalance.mockResolvedValueOnce(payload.amount - 1);

                    // Act
                    const actualResult = await proceedBetQueue.composeBalanceValidationCriteria(player, payload);

                    // Assert
                    expect(actualResult[0].failure).toBe(true);
                });
            });

            describe("when player coins is NOT less then bet amount", () => {
                it("should return result with NO fail criteria", async () => {
                    // Arrange
                    proceedBetQueue.getCoinBalance.mockResolvedValueOnce(payload.amount + 1);

                    // Act
                    const actualResult = await proceedBetQueue.composeBalanceValidationCriteria(player, payload);

                    // Assert
                    expect(actualResult[0].failure).toBe(false);
                });
            });
        });

        describe("when bet is NOT free bet", () => {
            it("should return empty array", async () => {
                // Arrange
                payload.freeBet = false;

                // Act
                const actualResult = await proceedBetQueue.composeBalanceValidationCriteria(player, payload);

                // Assert
                expect(actualResult.length).toBe(0);
            });
        });
    });

    describe("getCoinBalance", () => {
        it("should call userInfosRepository.findOne", async () => {
            // Arrange
            userInfosRepository.findOne().lean().exec.mockReturnValueOnce({});

            // Act
            await proceedBetQueue.getCoinBalance(player);

            // Assert
            expect(userInfosRepository.findOne).toBeCalled();
        });

        describe("when user scoins is undefined", () => {
            it("should return 0", async () => {
                // Arrange
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce({});

                // Act
                const actualResult = await proceedBetQueue.getCoinBalance(player);

                // Assert
                expect(actualResult).toBe(0);
            });
        });

        describe("when user scoins is number greater than 0", () => {
            it("should return user scoins", async () => {
                // Arrange
                const userScoins = 100;
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce({ scoins: userScoins });

                // Act
                const actualResult = await proceedBetQueue.getCoinBalance(player);

                // Assert
                expect(actualResult).toBe(userScoins);
            });
        });
    });

    describe("updateUserStakeLevel", () => {
        const minBet = 100;
        const maxBet = 20000;

        it("should call userInfosRepository.updateOne", async () => {
            // Act
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
            await proceedBetQueue.updateUserStakeLevel(player, minBet, maxBet);

            // Assert
            expect(userInfosRepository.updateOne).toBeCalledWith({ id: player.UID }, { minBet, maxBet, betLimitModifiedDate: mockDate });
        });

        it("should update user profile minBet", async () => {
            // Arrange
            const newPlayerMinBet = player.profile.minBet + 1;

            // Act
            await proceedBetQueue.updateUserStakeLevel(player, newPlayerMinBet, maxBet);

            // Assert
            expect(player.profile.minBet).toBe(newPlayerMinBet);
        });

        it("should update user profile maxBet", async () => {
            // Arrange
            const newPlayerMaxBet = player.profile.maxBet + 1;

            // Act
            await proceedBetQueue.updateUserStakeLevel(player, minBet, newPlayerMaxBet);

            // Assert
            expect(player.profile.maxBet).toBe(newPlayerMaxBet);
        });

        it("should call publish to user", async () => {
            // Arrange
            placeBetPublisher.publishToUser = jest.fn();

            // Act
            await proceedBetQueue.updateUserStakeLevel(player, minBet, maxBet);

            // Assert
            expect(placeBetPublisher.publishToUser).toBeCalledWith(player.UID, { userStakeLevel: { minBet, maxBet } }, definition.name);
        });
    });

    describe("handleFailedBet", () => {
        beforeEach(() => {
            proceedBetQueue.decreaseBetTracks = jest.fn();
            placeBetPublisher.publishGameFailedBet = jest.fn();
        });

        it("should call decreaseBetTracks", () => {
            // Act
            proceedBetQueue.handleFailedBet(player, {}, payload);

            // Assert
            expect(proceedBetQueue.decreaseBetTracks).toBeCalledWith(player.profile.name, payload);
        });

        describe("when apiError", () => {
            it("should call publishGameFailedBet with apiError property", () => {
                // Arrange
                const apiError = {
                    errorCode: 1000,
                };

                // Act
                proceedBetQueue.handleFailedBet(player, { apiError }, payload);

                // Assert
                expect(placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    apiError,
                });
            });
        });

        describe("when kickedOut", () => {
            it("should call publishGameFailedBet with kickOut property", () => {
                // Arrange
                const kickedOut = {
                    errorCode: 1000,
                };

                // Act
                proceedBetQueue.handleFailedBet(player, { kickedOut }, payload);

                // Assert
                expect(placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    kickedOut,
                });
            });
        });

        describe("when is not apiError and kickedOut", () => {
            it("should call publishGameFailedBet with notice", () => {
                // Arrange
                const notice = {};

                // Act
                proceedBetQueue.handleFailedBet(player, notice, payload);

                // Assert
                expect(placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice,
                });
            });
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
            expect(proceedBetQueue.calculateCurrencyRate).toBeCalledWith(player.session);
        });

        it("should call upsertBet", async () => {
            // Arrange
            const userCurrencyRate = chance.floating({ min: 1 });
            proceedBetQueue.upsertBet = jest.fn();
            proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValueOnce(userCurrencyRate);

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.upsertBet).toBeCalledWith(player, roundId, payload, userCurrencyRate);
        });

        it("should call isCountOnTotalBets", async () => {
            // Arrange
            jest.spyOn(proceedBetQueue, "isCountOnTotalBets");

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.isCountOnTotalBets).toBeCalledWith(player);
        });

        it("should call notifyPlacingBetResult", async () => {
            // Arrange
            const userCurrencyRate = chance.floating({ min: 1 });
            jest.spyOn(proceedBetQueue, "notifyPlacingBetResult");
            proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValueOnce(userCurrencyRate);

            // Act
            await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

            // Assert
            expect(proceedBetQueue.notifyPlacingBetResult).toBeCalledWith(player, response, payload, userCurrencyRate);
        });

        describe("when betLogsRepository is available", () => {
            it("should call insertBetLog", async () => {
                //Arrange
                const userCurrencyRate = chance.floating({ min: 1 });
                jest.spyOn(proceedBetQueue, "insertBetLog");
                proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValueOnce(userCurrencyRate);

                // Act
                await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

                // Assert
                expect(proceedBetQueue.insertBetLog).toBeCalledWith(player, roundId, payload, userCurrencyRate);
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
                const userCurrencyRate = chance.floating({ min: 1 });
                proceedBetQueue.isCountOnTotalBets = jest.fn().mockReturnValueOnce(true);
                proceedBetQueue.calculateCurrencyRate = jest.fn().mockReturnValueOnce(userCurrencyRate);
                jest.spyOn(proceedBetQueue, "adjustTotalBets");

                // Act
                await proceedBetQueue.handleSuccessBet(player, response, roundId, payload);

                // Assert
                expect(proceedBetQueue.adjustTotalBets).toBeCalledWith(player, payload, userCurrencyRate);
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
                proceedBetQueue.updateUserStakeLevel = jest.fn();

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
                player.session.currencyName = "USD";

                // Act
                const actualResult = proceedBetQueue.isCountOnTotalBets(player);

                // Assert
                expect(actualResult).toBe(true);
            });
        });

        describe("when player currency is test currency and isUncountOnTotal config is false", () => {
            it("should return true", () => {
                // Arrange
                player.session.currencyName = "IND";

                // Act
                const actualResult = proceedBetQueue.isCountOnTotalBets(player);

                // Assert
                expect(actualResult).toBe(true);
            });
        });

        describe("when player currency is test currency and isUncountOnTotal config is true", () => {
            it("should return false", () => {
                // Arrange
                player.session.currencyName = "UUS";

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
                currencyName: "USD",
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
            amount: chance.natural(),
            betChoice: "red2",
            roundId,
            receivedTime: new Date(),
        };
    };
});
