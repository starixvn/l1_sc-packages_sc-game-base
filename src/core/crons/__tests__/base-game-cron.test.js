import { stub, stubMongoose } from "jest-micro-auto-stub";
import { when } from "jest-when";
import mongoose from "mongoose";
import { logger } from "sc-common";

import cron from "cron";
import { GameConfig } from "jest-auto-fixture/src/models";
import { RoundIdConsumer, SettleGameRoundConsumer, PromotionFreeSpinsConsumer } from "../../event-consumers";
import ProvablyFairConsumer from "../../event-consumers/provably-fair-consumer";
import UnsettledRoundConsumer from "../../event-consumers/unsettled-round-consumer";
import GameStatusPublisher from "../../event-publishers/game-status-publisher";
import RunningRoundInfoPublisher from "../../event-publishers/running-round-info-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import GameManagementApiClientFactory from "../../game-management-api";
import BaseBot from "../base-bot";
import BaseGameCron from "../base-game-cron";

jest.mock("../base-bot");
jest.mock("../../event-consumers/provably-fair-consumer");
jest.mock("../../event-consumers/settle-game-round-consumer");
jest.mock("../../event-consumers/round-id-consumer");
jest.mock("../../event-consumers/promotion-free-spins-consumer");
jest.mock("../../event-publishers/running-round-info-publisher");
jest.mock("../../event-publishers/game-status-publisher");
jest.mock("cron");
jest.mock("../../helpers/promotion-helper", () => {
    return {
        getEffectivePromotion: jest.fn(() => {
            return {
                odds: { big: 10, small: 11 },
            };
        }),
    };
});

const gameData = new GameData(3);
gameData.gameConfigs = { gameId: 1 };
const definition = new GameDefinition(
    { id: 1, name: "game name", durations: { lockingBet: 2, wholeRound: 30, placingBets: 25 } },
    jest.fn,
    jest.fn,
    jest.fn
);
const bot = new BaseBot(gameData, definition);
const settleGameRoundConsumer = new SettleGameRoundConsumer();
const runningRoundInfoPublisher = new RunningRoundInfoPublisher();
const gameStatusPublisher = new GameStatusPublisher();
const provablyFairConsumer = new ProvablyFairConsumer();
const unsettledRoundConsumer = stub(UnsettledRoundConsumer);
const promotionFreeSpinsConsumer = new PromotionFreeSpinsConsumer();
promotionFreeSpinsConsumer.handlePromotionFreeSpinsExpiry = jest.fn();
promotionFreeSpinsConsumer.hasPromotionApiClient = jest.fn();

/** @type {logger}*/
const logService = stub(logger);

/** @type {mongoose.Model}*/
const resultsRepository = stubMongoose(mongoose.Model);

const roundResultConsumer = { generateServerSeedAndPublishHash: jest.fn() };

const appConfigs = { game: "aaa" };

const gameManagementApiClientFactory = new GameManagementApiClientFactory({});
const roundIdConsumer = new RoundIdConsumer(gameData, definition, jest.fn(), gameManagementApiClientFactory);

const createBaseGameCron = function (newGameData) {
    return new BaseGameCron({
        definition,
        gameData: newGameData ?? gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        roundResultConsumer,
        resultsRepository,
        appConfigs,
        gameManagementApiClientFactory,
        roundIdConsumer,
        provablyFairConsumer,
        unsettledRoundConsumer,
        promotionFreeSpinsConsumer,
    });
};

describe("start", () => {
    it("should call initRoundId", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.roundIdConsumer.initRoundId).toHaveBeenCalledWith();
    });

    it("should call queryLastResult", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.queryLastResult).toHaveBeenCalledWith();
    });

    it("should call getSettingForNewRound", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.getSettingForNewRound).toHaveBeenCalledWith();
    });

    it("should call updateExchangeRates", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.updateExchangeRates).toHaveBeenCalledWith();
    });

    it("should call startCron", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.startCron).toHaveBeenCalledWith();
    });

    it("should call checkPromotionReadiness", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastResult = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.checkPromotionReadiness = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.checkPromotionReadiness).toHaveBeenCalledWith();
    });
});

describe("checkPromotionReadiness", () => {
    it("should set gameData.promotionReady to true when promotionApiClient is available", () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.promotionFreeSpinsConsumer.hasPromotionApiClient.mockReturnValue(true);

        // Act
        gameCron.checkPromotionReadiness();

        // Assert
        expect(gameCron.gameData.promotionReady).toBe(true);
    });

    it("should set gameData.promotionReady to false when promotionApiClient is null", () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.promotionFreeSpinsConsumer.hasPromotionApiClient.mockReturnValue(false);

        // Act
        gameCron.checkPromotionReadiness();

        // Assert
        expect(gameCron.gameData.promotionReady).toBe(false);
    });

    it("should set gameData.promotionReady to false when promotionApiClient is undefined", () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.promotionFreeSpinsConsumer.hasPromotionApiClient.mockReturnValue(false);

        // Act
        gameCron.checkPromotionReadiness();

        // Assert
        expect(gameCron.gameData.promotionReady).toBe(false);
    });

    it("should set gameData.promotionReady to false when promotionFreeSpinsConsumer is not injected", () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.promotionFreeSpinsConsumer = null;

        // Act
        gameCron.checkPromotionReadiness();

        // Assert
        expect(gameCron.gameData.promotionReady).toBe(false);
    });

    it("should set gameData.promotionReady to false when promotionFreeSpinsConsumer is undefined", () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.promotionFreeSpinsConsumer = undefined;

        // Act
        gameCron.checkPromotionReadiness();

        // Assert
        expect(gameCron.gameData.promotionReady).toBe(false);
    });
});

describe("queryLastResult", () => {
    describe("when resultsRepository is null", () => {
        it("should not update lastResultRecord", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.resultsRepository = null;

            // Act
            await gameCron.queryLastResult();

            // Assert
            expect(gameCron.gameData.lastResultRecord).toBe(undefined);
        });
    });

    describe("when resultsRepository exists", () => {
        it("should find lastResultRecord", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            const lastResultRecord = { x: 1 };
            gameCron.resultsRepository = { findOne: jest.fn() };
            const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(lastResultRecord) }) };
            when(gameCron.resultsRepository.findOne).calledWith({ roundId: 123 }).mockReturnValue(findOneResult);
            gameCron.gameData.roundId = 123;

            // Act
            await gameCron.queryLastResult();

            // Assert
            expect(gameCron.gameData.lastResultRecord).toBe(lastResultRecord);
        });
    });
});

describe("startCron", () => {
    describe("cronTime", () => {
        it("should be every second", () => {
            // Arrange
            const gameCron = createBaseGameCron();
            cron.CronJob = jest.fn(() => {
                return { start: jest.fn() };
            });

            // Act
            gameCron.startCron();

            // Assert
            expect(cron.CronJob.mock.calls[0][0]).toBe("* * * * * *");
        });
    });

    describe("onStick", () => {
        it("should call proceed", () => {
            // Arrange
            const gameCron = createBaseGameCron();
            cron.CronJob = jest.fn(() => {
                return { start: jest.fn() };
            });
            gameCron.proceed = jest.fn(() => {
                return { catch: jest.fn() };
            });

            // Act
            gameCron.startCron();
            cron.CronJob.mock.calls[0][1]();

            // Assert
            expect(gameCron.proceed).toHaveBeenCalledWith();
        });

        it("should call catch", () => {
            // Arrange
            const gameCron = createBaseGameCron();
            cron.CronJob = jest.fn(() => {
                return { start: jest.fn() };
            });
            const catchFunc = jest.fn();
            gameCron.proceed = jest.fn(() => {
                return { catch: catchFunc };
            });

            // Act
            gameCron.startCron();
            cron.CronJob.mock.calls[0][1]();

            // Assert
            expect(catchFunc).toHaveBeenCalledWith(gameCron.logService.logError);
        });
    });

    describe("onComplete", () => {
        it("should log error", () => {
            // Arrange
            const gameCron = createBaseGameCron();
            const startFunc = jest.fn();
            cron.CronJob = jest.fn(() => {
                return { start: startFunc };
            });
            gameCron.logService.logError = jest.fn();
            gameCron.gameData.roundId = 12;

            // Act
            gameCron.startCron();
            cron.CronJob.mock.calls[0][2]();

            // Assert
            expect(gameCron.logService.logError).toHaveBeenCalledWith(
                `${definition.name} unexpectedly stopped at round #12 because some other tasks halt it.`
            );
        });

        it("should call start job", () => {
            // Arrange
            const gameCron = createBaseGameCron();
            const startFunc = jest.fn();
            cron.CronJob = jest.fn(() => {
                return { start: startFunc };
            });
            gameCron.logService.logError = jest.fn();
            gameCron.gameData.roundId = 12;

            // Act
            gameCron.startCron();
            cron.CronJob.mock.calls[0][2]();

            // Assert
            expect(startFunc).toHaveBeenCalledTimes(2);
        });
    });
});

describe("proceed", () => {
    describe("when remainingTime = wholeRound", () => {
        it("should call checkGameStatus", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.definition.durations = { wholeRound: 12 };
            gameCron.gameData.remainingTime = 12;
            gameCron.checkGameStatus = jest.fn();

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.checkGameStatus).toHaveBeenCalled();
        });
    });

    describe("when gameData.disabled is false", () => {
        it("should reduce remainingTime by 1", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.disabled = false;
            gameCron.gameData.remainingTime = 123;

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.gameData.remainingTime).toBe(122);
        });
    });

    describe("when isStartingTime true", () => {
        it("should call resetForNewRound", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = 11;
            gameCron.definition.durations = { wholeRound: 22 };
            gameCron.isStartingTime = jest.fn();
            when(gameCron.isStartingTime).calledWith(11, gameCron.definition.durations).mockReturnValue(true);
            gameCron.resetForNewRound = jest.fn();
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
            };
            gameCron.gameData.lastResultRecord = { id: 122 };
            gameCron.bot = { reset: jest.fn() };
            gameCron.gameData.disabled = true;
            gameCron.appConfigs = {
                enabledBoostedOdds: true,
            };
            gameCron.updatePromotionOddsAndNotify = jest.fn();

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.resetForNewRound).toHaveBeenCalled();
        });

        it("should reset bot", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = 11;
            gameCron.definition.durations = { wholeRound: 22 };
            gameCron.isStartingTime = jest.fn();
            when(gameCron.isStartingTime).calledWith(11, gameCron.definition.durations).mockReturnValue(true);
            gameCron.resetForNewRound = jest.fn();
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
            };
            gameCron.gameData.lastResultRecord = { id: 122 };
            gameCron.bot = { reset: jest.fn() };
            gameCron.gameData.disabled = true;
            gameCron.appConfigs = {
                enabledBoostedOdds: true,
            };
            gameCron.updatePromotionOddsAndNotify = jest.fn();

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.bot.reset).toHaveBeenCalled();
        });
    });

    describe("when placingBets time", () => {
        it("should generate result and publish server seed hash", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = 20;
            gameCron.definition.durations = { wholeRound: 22, placingBets: 20 };
            gameCron.isStartingTime = jest.fn();
            when(gameCron.isStartingTime).calledWith(11, gameCron.definition.durations).mockReturnValue(true);
            gameCron.resetForNewRound = jest.fn();
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
            };
            gameCron.gameData.lastResultRecord = { id: 122 };
            gameCron.bot = { reset: jest.fn() };
            gameCron.gameData.disabled = true;
            gameCron.resultsRepository = {};

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.roundResultConsumer.generateServerSeedAndPublishHash).toHaveBeenCalledWith({ id: 122 });
        });
    });

    describe("when remainingTime < 0", () => {
        it("should update remainingTime = wholeRound", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData = {
                remainingTime: -1,
                gameConfigs: { gameId: 1 },
            };
            gameCron.definition.durations = { wholeRound: 10 };
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
                generateResult: jest.fn(),
            };

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.gameData.remainingTime).toBe(10);
        });

        it("should call settleRound", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData = {
                remainingTime: -1,
                gameConfigs: { gameId: 1 },
            };
            gameCron.definition.durations = { wholeRound: 10 };
            gameCron.settleGameRoundConsumer = {
                settleRound: jest.fn(),
            };
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
                generateResult: jest.fn(),
            };

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.settleGameRoundConsumer.settleRound).toHaveBeenCalledWith(gameCron.gameData);
        });

        it("should reset settlementResultFromAdmin", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = -1;
            gameCron.gameData.gameConfigs = { gameId: 1 };
            gameCron.definition.durations = { wholeRound: 22, placingBets: 20 };
            gameCron.settleGameRoundConsumer = {
                settleRound: jest.fn(),
            };
            gameCron.gameData.settlementResultFromAdmin = { result: {} };
            gameCron.roundResultConsumer = {
                generateServerSeedAndPublishHash: jest.fn(),
                generateResult: jest.fn(),
            };

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.gameData.settlementResultFromAdmin).toEqual({});
        });

        describe("when having resultsRepository value", () => {
            it("should call roundResultConsumer.generateResult", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.remainingTime = -1;
                gameCron.gameData.gameConfigs = { gameId: 1 };
                gameCron.definition.durations = { wholeRound: 22, placingBets: 20, mergeClientSeeds: 1 };
                gameCron.isStartingTime = jest.fn();
                when(gameCron.isStartingTime).calledWith(11, gameCron.definition.durations).mockReturnValue(true);
                gameCron.resetForNewRound = jest.fn();
                gameCron.roundResultConsumer = {
                    generateServerSeedAndPublishHash: jest.fn(),
                    generateResult: jest.fn(),
                };
                gameCron.gameData.lastResultRecord = { id: 122 };
                gameCron.bot = { reset: jest.fn(), run: jest.fn() };
                gameCron.gameData.disabled = true;
                gameCron.resultsRepository = {};

                // Act
                await gameCron.proceed();

                // Assert
                expect(gameCron.roundResultConsumer.generateResult).toHaveBeenCalled();
            });
        });

        describe("when NOT having resultsRepository value", () => {
            it("should NOT call roundResultConsumer.generateResult", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.remainingTime = -1;
                gameCron.definition.durations = { wholeRound: 22, placingBets: 20, mergeClientSeeds: 1 };
                gameCron.isStartingTime = jest.fn();
                when(gameCron.isStartingTime).calledWith(11, gameCron.definition.durations).mockReturnValue(true);
                gameCron.resetForNewRound = jest.fn();
                gameCron.roundResultConsumer = {
                    generateServerSeedAndPublishHash: jest.fn(),
                    generateResult: jest.fn(),
                };
                gameCron.gameData.lastResultRecord = { id: 122 };
                gameCron.bot = { reset: jest.fn(), run: jest.fn() };
                gameCron.gameData.disabled = true;
                gameCron.resultsRepository = undefined;

                // Act
                await gameCron.proceed();

                // Assert
                expect(gameCron.roundResultConsumer.generateResult).not.toHaveBeenCalled();
            });
        });
    });

    describe("when remainingTime < durations.placingBets", () => {
        it("should call bot run", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = 10;
            gameCron.definition.durations = { placingBets: 11 };
            gameCron.bot = { run: jest.fn() };
            gameCron.runningRoundInfoPublisher = {
                publish: jest.fn(),
            };

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.bot.run).toHaveBeenCalled();
        });

        it("should publish round info", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.gameData.remainingTime = 10;
            gameCron.definition.durations = { placingBets: 11 };
            gameCron.bot = { run: jest.fn() };
            gameCron.runningRoundInfoPublisher = {
                publish: jest.fn(),
            };

            // Act
            await gameCron.proceed();

            // Assert
            expect(gameCron.runningRoundInfoPublisher.publish).toHaveBeenCalled();
        });
    });
});

describe("checkGameStatus", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
    });

    describe("always get settings for new round ", () => {
        it("should update currency group games", () => {});
        it("should update site exclusions", () => {});
        it("should update currency groups", () => {});
        it("should update currencies", () => {});
    });

    describe("when exchangeReload is true ", () => {
        let baseGameCron;

        beforeEach(() => {
            jest.clearAllMocks();
            baseGameCron = createBaseGameCron();
            baseGameCron.appConfigs = {};
            const data = { isSuccessful: true, data: GameConfig({ exchangeReload: true }) };

            baseGameCron.gameManagementApiClient.gameConfigs.getGameConfigs.mockReturnValueOnce(data);
            baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload.mockReturnValueOnce({});
            baseGameCron.gameManagementApiClient.gameConfigs.updateDisabledround.mockReturnValueOnce({});

            baseGameCron.gameManagementApiClient.notification.getUmMessages.mockReturnValueOnce({});
        });

        it("should update new exchange rates", async () => {
            // Arrange
            baseGameCron.updateExchangeRates = jest.fn();

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(baseGameCron.updateExchangeRates).toBeCalledTimes(1);
        });

        it("should update exchangeReload to false", async () => {
            // Arrange
            baseGameCron.updateExchangeRates = jest.fn();

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload).toBeCalledWith(false, definition.name);
        });
    });

    describe("when can NOT get new game configs", () => {
        let baseGameCron;

        beforeEach(() => {
            jest.clearAllMocks();

            baseGameCron = createBaseGameCron(new GameData(4));
            baseGameCron.appConfigs = {};

            baseGameCron.gameManagementApiClient.gameConfigs.getGameConfigs.mockReturnValueOnce({ isSuccessful: false });
            baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload.mockReturnValueOnce({});
            baseGameCron.gameManagementApiClient.gameConfigs.updateDisabledround.mockReturnValueOnce({});
        });

        it("game should be disabled", async () => {
            // Arrange

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(baseGameCron.gameData.disabled).toBe(true);
        });
    });

    describe("when previouslyDisabled true", () => {
        let baseGameCron;

        beforeEach(() => {
            jest.clearAllMocks();

            const data = { isSuccessful: true, data: GameConfig({ exchangeReload: true }) };
            baseGameCron = createBaseGameCron();
            baseGameCron.appConfigs = {};
            baseGameCron.gameData.disabled = true;

            baseGameCron.gameManagementApiClient.gameConfigs.getGameConfigs.mockReturnValueOnce(data);
            baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload.mockReturnValueOnce({});
            baseGameCron.gameManagementApiClient.gameConfigs.updateDisabledround.mockReturnValueOnce({});
        });

        it("should get delay start time", async () => {
            // Arrange
            baseGameCron.getDelayStartTime = jest.fn();

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(baseGameCron.getDelayStartTime).toBeCalledTimes(1);
        });

        it("should update delay start time", async () => {
            // Arrange
            const expected = 8;
            baseGameCron.getDelayStartTime = jest.fn().mockReturnValueOnce(expected);

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(baseGameCron.gameData.delayStartTime).toBe(expected);
        });
    });

    describe("when have new game configs", () => {
        let baseGameCron, gameConfigs;

        beforeEach(() => {
            baseGameCron = createBaseGameCron();
            baseGameCron.appConfigs = {};
            gameConfigs = { enabled: true };
            const data = { data: gameConfigs, isSuccessful: true };

            baseGameCron.gameManagementApiClient.gameConfigs.getGameConfigs.mockReturnValueOnce(data);
            baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload.mockReturnValueOnce({});
            baseGameCron.gameManagementApiClient.gameConfigs.updateDisabledround.mockReturnValueOnce({});
        });

        it("should update gameData.gameConfigs", async () => {
            // Arrange

            // Act
            await baseGameCron.checkGameStatus();

            // Assert
            expect(gameData.gameConfigs).toEqual(gameConfigs);
        });
    });

    it("always call handleGameStatus", async () => {
        // Arrange
        jest.clearAllMocks();
        const baseGameCron = createBaseGameCron();
        baseGameCron.appConfigs = {};
        const data = { isSuccessful: true, data: GameConfig({ exchangeReload: true }) };

        baseGameCron.gameManagementApiClient.gameConfigs.getGameConfigs.mockReturnValueOnce(data);
        baseGameCron.gameManagementApiClient.gameConfigs.updateExchangeReload.mockReturnValueOnce({});
        baseGameCron.gameManagementApiClient.gameConfigs.updateDisabledround.mockReturnValueOnce({});

        baseGameCron.handleGameStatus = jest.fn();

        // Act
        await baseGameCron.checkGameStatus();

        // Assert
        expect(baseGameCron.handleGameStatus).toBeCalledTimes(1);
    });
});

describe("resetForNewRound", () => {
    it("should reset ingame", () => {
        // Arrange
        const gameCron = createBaseGameCron();

        // Act
        gameCron.resetForNewRound();

        // Assert
        expect(gameCron.gameData.ingame).toEqual({});
    });

    it("should reset totalBets", () => {
        // Arrange
        const gameCron = createBaseGameCron();

        // Act
        gameCron.resetForNewRound();

        // Assert
        expect(gameCron.gameData.totalBets).toEqual({});
    });

    it("should reset settleResultFromAdmin", () => {
        // Arrange
        const gameCron = createBaseGameCron();

        // Act
        gameCron.resetForNewRound();

        // Assert
        expect(gameCron.gameData.settlementResultFromAdmin).toEqual({});
    });
});

describe("getSettingForNewRound", () => {
    it("should update CurrencyGroupGames, partnerGameSiteExclusions, currencyGroups, currencies", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        const responseResult = {
            isSuccessful: true,
            data: {
                currencyGroupGames: { group: 1 },
                partnerGameSiteExclusions: { site_exclusion: 123 },
                currencyGroups: { "currency-group": 123 },
                currencies: { currencies: 123 },
            },
        };
        gameCron.gameManagementApiClient.aggregation.getSettingForNewRound.mockReturnValueOnce(responseResult);

        // Act
        await gameCron.getSettingForNewRound();

        // Assert
        expect(gameCron.gameData.currencyGroupGames).toEqual({ group: 1 });
        expect(gameCron.gameData.partnerGameSiteExclusions).toEqual({ site_exclusion: 123 });
        expect(gameCron.gameData.currencyGroups).toEqual({ "currency-group": 123 });
        expect(gameCron.gameData.currencies).toEqual({ currencies: 123 });
    });
});

describe("updateExchangeRates", () => {
    it("should get exchangeRates", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        const exchangeRates = { EUR: 1, US: 2 };
        const result = { data: exchangeRates, isSuccessful: true };
        gameCron.gameManagementApiClient = {
            exchangeRates: {
                getExchangeRates: async () => {
                    return new Promise((resolve) => {
                        resolve(result);
                    });
                },
            },
        };

        // Act
        await gameCron.updateExchangeRates();

        // Assert
        expect(gameCron.gameData.exchangeRates).toBe(exchangeRates);
    });
});

describe("updateCurrencyGroupGames", () => {
    it("should get currencyGroupGames", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        gameCron.definition.id = 111;
        const currencyGroupGames = { EUR: ["EUR1", "EUR2"] };
        const result = { data: currencyGroupGames, isSuccessful: true };
        gameCron.gameManagementApiClient = {
            currencyGroupGames: {
                getCurrencyGroupGamesByGameId: async () => {
                    return new Promise((resolve) => {
                        resolve(result);
                    });
                },
            },
        };

        // Act
        await gameCron.updateCurrencyGroupGames();

        // Assert
        expect(gameCron.gameData.currencyGroupGames).toBe(currencyGroupGames);
    });
});

describe("updatePartnerGameSiteExclusions", () => {
    it("should partnerGameSiteExclusions", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        const partnerGameSiteExclusions = ["site1", "site2"];
        const result = { data: partnerGameSiteExclusions, isSuccessful: true };
        gameCron.gameManagementApiClient = {
            operatorConfig: {
                getGameSiteExclusions: async () => {
                    return new Promise((resolve) => {
                        resolve(result);
                    });
                },
            },
        };

        // Act
        await gameCron.updatePartnerGameSiteExclusions();

        // Assert
        expect(gameCron.gameData.partnerGameSiteExclusions).toBe(partnerGameSiteExclusions);
    });
});

describe("updateCurrencyGroups", () => {
    it("should get currencyGroups", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        const currencyGroups = ["EUR", "US"];
        const result = { data: currencyGroups, isSuccessful: true };

        gameCron.gameManagementApiClient = {
            currencyGroups: {
                getCurrencyGroups: async () => {
                    return new Promise((resolve) => {
                        resolve(result);
                    });
                },
            },
        };

        // Act
        await gameCron.updateCurrencyGroups();

        // Assert
        expect(gameCron.gameData.currencyGroups).toBe(currencyGroups);
    });
});

describe("updateCurrencies", () => {
    it("should get currencies", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        const currencies = ["EUR", "US"];
        const result = { data: currencies, isSuccessful: true };
        gameCron.gameManagementApiClient = {
            currencies: {
                getCurrencies: async () => {
                    return new Promise((resolve) => {
                        resolve(result);
                    });
                },
            },
        };

        // Act
        await gameCron.updateCurrencies();

        // Assert
        expect(gameCron.gameData.currencies).toBe(currencies);
    });
});

describe("enableGame", () => {
    it("should publishEnablingGameStatus", async () => {
        // Arrange
        const gameCron = createBaseGameCron();
        gameCron.gameStatusPublisher = {
            publishEnablingGameStatus: jest.fn(),
        };

        // Act
        await gameCron.enableGame();

        // Assert
        expect(gameCron.gameStatusPublisher.publishEnablingGameStatus).toHaveBeenCalled();
    });
});

describe("assignNewGameConfigs", () => {
    let gameCron;

    beforeEach(() => {
        gameCron = createBaseGameCron();
    });

    it("should assign NEW config", () => {
        // Arrange
        const newConfig = GameConfig({ odds: { small: 2 } });
        gameCron.gameData.gameConfigs = GameConfig();

        // Act
        gameCron.assignNewGameConfigs(newConfig);

        // Assert
        expect(gameCron.gameData.gameConfigs).toEqual(newConfig);
    });

    it("should update NEW config", () => {
        // Arrange
        const newConfig = GameConfig({ odds: { small: 3 } });
        gameCron.gameData.gameConfigs = GameConfig({ odds: { small: 2 } });

        // Act
        gameCron.assignNewGameConfigs(newConfig);

        // Assert
        expect(gameCron.gameData.gameConfigs).toEqual(newConfig);
    });
});

describe("getDelayStartTime", () => {
    let gameCron;

    beforeEach(() => {
        gameCron = createBaseGameCron();
    });

    describe("when delayStartTime greather than 0", () => {
        it("should decrease delayStartTime value", () => {
            // Arrange
            gameCron.gameData.delayStartTime = 2;

            // Act
            const actualDelay = gameCron.getDelayStartTime(false, GameConfig());

            // Assert
            expect(actualDelay).toEqual(1);
        });
    });

    describe("when delayStartTime less than equal 0", () => {
        describe("when configuredlyDisabled is false", () => {
            it("delayStartTime will be same with newGameConfig if exist", () => {
                // Arrange
                const newGameConfig = GameConfig({ delayStartTime: 15 });
                gameCron.gameData.delayStartTime = 0;

                // Act
                const actualDelay = gameCron.getDelayStartTime(false, newGameConfig);

                // Assert
                expect(actualDelay).toEqual(newGameConfig.delayStartTime);
            });

            it("delayStartTime will be 0 if newGameConfig is null", () => {
                // Arrange
                gameCron.gameData.delayStartTime = -1;

                // Act
                const actualDelay = gameCron.getDelayStartTime(false, null);

                // Assert
                expect(actualDelay).toEqual(0);
            });
        });

        describe("when configuredlyDisabled is true", () => {
            it("delayStartTime will be 0 ", () => {
                // Arrange
                gameCron.gameData.delayStartTime = -1;

                // Act
                const actualDelay = gameCron.getDelayStartTime(false, null);

                // Assert
                expect(actualDelay).toEqual(0);
            });
        });
    });
});

describe("handleGameStatus", () => {
    let baseGameCron;

    beforeEach(() => {
        jest.clearAllMocks();
        baseGameCron = createBaseGameCron(new GameData(4));
    });
    describe("when status is enabled", () => {
        beforeEach(() => {
            baseGameCron.gameData.disabled = false;
        });
        describe("when previouslyDisabled true", () => {
            it("should call enableGame", async () => {
                // Arrange
                baseGameCron.enableGame = jest.fn();

                // Act
                await baseGameCron.handleGameStatus(true);

                // Assert
                expect(baseGameCron.enableGame).toHaveBeenCalledTimes(1);
            });
        });

        describe("when NOT previouslyDisabled", () => {
            it("should call publishStartGame", async () => {
                // Act
                await baseGameCron.handleGameStatus(false);

                // Assert
                expect(gameStatusPublisher.publishStartGame).toHaveBeenCalled();
            });
        });
    });

    describe("when status is disabled", () => {
        beforeEach(() => {
            baseGameCron.gameData.disabled = true;
        });

        it("should get UM messages", async () => {
            // Arrange
            const umMessageResponse = { isSuccessful: true, data: "disabled" };
            baseGameCron.gameManagementApiClient.notification.getUmMessages.mockReturnValueOnce(umMessageResponse);

            // Act
            await baseGameCron.handleGameStatus(false);

            // Assert
            expect(baseGameCron.gameData.umMessages).toEqual(umMessageResponse.data);
        });

        it("should reset gameData.remainingTime", async () => {
            // Arrange

            // Act
            await baseGameCron.handleGameStatus(false);

            // Assert
            expect(baseGameCron.gameData.remainingTime).toEqual(definition.durations.wholeRound);
        });

        it("should call publishDisableGameStatus", async () => {
            // Arrange

            // Act
            await baseGameCron.handleGameStatus(false);

            // Assert
            expect(gameStatusPublisher.publishDisableGameStatus).toHaveBeenCalled();
        });
    });
});
