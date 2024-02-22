import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";
import { when } from "jest-when";

import SettleGameRoundConsumer from "../../event-consumers/settle-game-round-consumer";
import GameStatusPublisher from "../../event-publishers/game-status-publisher";
import RunningRoundInfoPublisher from "../../event-publishers/running-round-info-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import BaseBot from "../base-bot";
import BaseGameCron from "../base-game-cron";
import cron from "cron";
import ProvablyFairConsumer from "../../event-consumers/provably-fair-consumer";

jest.mock("../base-bot");
jest.mock("../../event-consumers/settle-game-round-consumer");
jest.mock("../../event-consumers/provably-fair-consumer");
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

/** @type {logger}*/
const logService = stub(logger);

/** @type {mongoose.Model}*/
const gameConfigsRepository = stubMongoose(mongoose.Model);
gameConfigsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const roundsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const notificationRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const archiveRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const exchangeRatesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupGamesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const partnerConfigRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyRepository = stubMongoose(mongoose.Model);

const roundResultConsumer = { generateServerSeedAndPublishHash: jest.fn() };

const createBaseGameCron = function () {
    return new BaseGameCron({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        provablyFairConsumer,
    });
};

describe("gameCron", () => {
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
            expect(gameCron.initRoundId).toHaveBeenCalledWith();
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
    });

    describe("initRoundId", () => {
        describe("when last round exists", () => {
            it("should update roundid = last round id + 1", async () => {
                // Arrange
                const lastRound = { id: 123 };
                var gameCron = createBaseGameCron();
                gameCron.roundsRepository = { findOne: jest.fn() };
                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(lastRound) }) };
                when(gameCron.roundsRepository.findOne)
                    .calledWith({}, "id", { sort: { id: -1 } })
                    .mockReturnValue(findOneResult);

                // Act
                await gameCron.initRoundId();

                // Assert
                expect(gameCron.gameData.roundId).toBe(124);
            });
        });

        describe("when last round does not exist", () => {
            it("should get round id from archiveRound", async () => {
                // Arrange
                const lastRoundId = 125;
                var gameCron = createBaseGameCron();
                gameCron.roundsRepository = { findOne: jest.fn() };
                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(undefined) }) };
                when(gameCron.roundsRepository.findOne)
                    .calledWith({}, "id", { sort: { id: -1 } })
                    .mockReturnValue(findOneResult);

                gameCron.getLastArchiveRound = jest.fn().mockReturnValue(lastRoundId);

                // Act
                await gameCron.initRoundId();

                // Assert
                expect(gameCron.gameData.roundId).toBe(125);
            });
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
                gameCron.definition.name = "name 1";
                gameCron.gameData.roundId = 12;

                // Act
                gameCron.startCron();
                cron.CronJob.mock.calls[0][2]();

                // Assert
                expect(gameCron.logService.logError).toHaveBeenCalledWith(
                    `name 1 unexpectedly stopped at round #12 because some other tasks halt it.`
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
                gameCron.definition.name = "name 1";
                gameCron.gameData.roundId = 12;

                // Act
                gameCron.startCron();
                cron.CronJob.mock.calls[0][2]();

                // Assert
                expect(startFunc).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe("getLastArchiveRound", () => {
        describe("when archive exists", () => {
            const testCases = [{ _phiens: 123 }, { _rounds: 123 }];

            it.each(testCases)("should return last phien + 1", async (data) => {
                // Arrange
                const archiveStatus = { lastArcId: data };
                const configName = "config name 1";
                const gameCron = createBaseGameCron();
                gameCron.definition.configName = configName;
                gameCron.archiveStatusesRepository = { findOne: jest.fn() };
                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(archiveStatus) }) };
                when(gameCron.archiveStatusesRepository.findOne)
                    .calledWith({ name: configName }, "lastArcId")
                    .mockReturnValue(findOneResult);

                // Act
                const result = await gameCron.getLastArchiveRound();

                // Assert
                expect(result).toBe(124);
            });
        });

        describe("when archive does not exist", () => {
            it("should return 1", async () => {
                // Arrange
                const archiveStatus = null;
                const configName = "config name 1";
                const gameCron = createBaseGameCron();
                gameCron.definition.configName = configName;
                gameCron.archiveStatusesRepository = { findOne: jest.fn() };
                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(archiveStatus) }) };
                when(gameCron.archiveStatusesRepository.findOne)
                    .calledWith({ name: configName }, "lastArcId")
                    .mockReturnValue(findOneResult);

                // Act
                const result = await gameCron.getLastArchiveRound();

                // Assert
                expect(result).toBe(1);
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

            it("should reset settlementResultFromAdmin", async () => {
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
                gameCron.gameData.settlementResultFromAdmin = { x: 123 };
                gameCron.resultsRepository = {};

                // Act
                await gameCron.proceed();

                // Assert
                expect(gameCron.gameData.settlementResultFromAdmin).toEqual({});
            });
        });

        describe("when remainingTime = durations.mergeClientSeeds", () => {
            describe("when having resultsRepository value", () => {
                it("should call roundResultConsumer.generateResult", async () => {
                    // Arrange
                    const gameCron = createBaseGameCron();
                    gameCron.gameData.remainingTime = 1;
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
                    gameCron.gameData.remainingTime = 1;
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

        describe("when remainingTime < 0", () => {
            it("should update remainingTime = wholeRound", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData = {
                    remainingTime: -1,
                };
                gameCron.definition.durations = { wholeRound: 10 };

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
                };
                gameCron.definition.durations = { wholeRound: 10 };
                gameCron.settleGameRoundConsumer = {
                    settleRound: jest.fn(),
                };

                // Act
                await gameCron.proceed();

                // Assert
                expect(gameCron.settleGameRoundConsumer.settleRound).toHaveBeenCalledWith(gameCron.gameData);
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

    describe("checkGameStatus tests", () => {
        describe("when game is enabled", () => {
            it("should update gameData.gameConfigs", async () => {
                // Arrange
                const gameConfigs = { enabled: true, boostedChoices: [] };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Assert
                expect(gameData.gameConfigs).toEqual(gameConfigs);
            });

            it("should call publishStartGame", async () => {
                // Arrange
                const gameConfigs = { enabled: true };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameStatusPublisher.publishStartGame).toHaveBeenCalled();
            });
        });

        describe("game is disabled", () => {
            it("should update game configs", async () => {
                // Arrange
                const gameConfigs = { enabled: false, boostedChoices: [] };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameData.gameConfigs).toEqual(gameConfigs);
            });

            it("should reset gameData.remainingTime", async () => {
                // Arrange
                const gameConfigs = { enabled: false };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameData.remainingTime).toEqual(definition.durations.wholeRound);
            });

            it("should call updateOne", async () => {
                // Arrange
                const gameConfigs = { enabled: false };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameConfigsRepository.updateOne).toHaveBeenCalled();
            });

            it("should call publishDisableGameStatus", async () => {
                // Arrange
                const gameConfigs = { enabled: false };
                gameData.disabled = false;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameStatusPublisher.publishDisableGameStatus).toHaveBeenCalled();
            });
        });

        describe("when game is currently disabled, then being enabled", () => {
            it("should update gameConfig", async () => {
                // Arrange
                const gameConfigs = { enabled: true, boostedChoices: [] };
                gameData.disabled = true;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameData.gameConfigs).toEqual(gameConfigs);
            });

            it("should call publishEnablingGameStatus", async () => {
                // Arrange
                const gameConfigs = { enabled: true };
                gameData.disabled = true;
                gameData.remainingTime = definition.durations.wholeRound;
                gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

                const baseGameCron = createBaseGameCron();
                baseGameCron.appConfigs = {};

                // Act
                await baseGameCron.checkGameStatus();

                // Asset
                expect(gameStatusPublisher.publishEnablingGameStatus).toHaveBeenCalled();
            });
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
        it("should updateCurrencyGroupGames", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.updateCurrencyGroupGames = jest.fn();

            // Act
            await gameCron.getSettingForNewRound();

            // Assert
            expect(gameCron.updateCurrencyGroupGames).toHaveBeenCalled();
        });

        it("should updatePartnerGameSiteExclusions", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.updatePartnerGameSiteExclusions = jest.fn();

            // Act
            await gameCron.getSettingForNewRound();

            // Assert
            expect(gameCron.updatePartnerGameSiteExclusions).toHaveBeenCalled();
        });

        it("should updateCurrencyGroups", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.updateCurrencyGroups = jest.fn();

            // Act
            await gameCron.getSettingForNewRound();

            // Assert
            expect(gameCron.updateCurrencyGroups).toHaveBeenCalled();
        });

        it("should updateCurrencies", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.updateCurrencies = jest.fn();

            // Act
            await gameCron.getSettingForNewRound();

            // Assert
            expect(gameCron.updateCurrencies).toHaveBeenCalled();
        });
    });

    describe("updateExchangeRates", () => {
        it("should get exchangeRates", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            const exchangeRates = { EUR: 1, US: 2 };
            gameCron.exchangeRatesRepository = { findOne: jest.fn() };
            const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(exchangeRates) }) };
            when(gameCron.exchangeRatesRepository.findOne)
                .calledWith({}, "exId code", { sort: { exId: -1 } })
                .mockReturnValue(findOneResult);

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
            gameCron.currencyGroupGamesRepository = { find: jest.fn() };
            const findResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(currencyGroupGames) }) };
            when(gameCron.currencyGroupGamesRepository.find)
                .calledWith({ gameId: 111, enabled: true }, "groupId minBet maxBet maxBetPerChoices chips stakeLevels")
                .mockReturnValue(findResult);

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
            gameCron.partnerConfigRepository = { find: jest.fn() };
            const findResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(partnerGameSiteExclusions) }) };
            when(gameCron.partnerConfigRepository.find)
                .calledWith({ type: "game_site_exclusions" }, "partnerId type value")
                .mockReturnValue(findResult);

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
            gameCron.currencyGroupRepository = { find: jest.fn() };
            const findResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(currencyGroups) }) };
            when(gameCron.currencyGroupRepository.find).calledWith({ enabled: true }, "name enabled partnerId").mockReturnValue(findResult);

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
            gameCron.currencyRepository = { find: jest.fn() };
            const findResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(currencies) }) };
            when(gameCron.currencyRepository.find)
                .calledWith({ enabled: true }, "name code multiplier enabled partnerId groupId isTest isUncountOnTotal")
                .mockReturnValue(findResult);

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

    describe("updatePromotionOdds", () => {
        describe("when gameConfigs not existed", () => {
            it("should do nothing", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.gameConfigs = {
                    x: 123,
                };

                // Act
                await gameCron.updatePromotionOdds();

                // Assert
                expect(gameCron.gameData.gameConfigs).toEqual({ x: 123 });
            });
        });

        describe("when gameConfigs.odds not existed", () => {
            it("should do nothing", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.gameConfigs = {
                    x: 123,
                };

                // Act
                await gameCron.updatePromotionOdds();

                // Assert
                expect(gameCron.gameData.gameConfigs).toEqual({ x: 123 });
            });
        });

        describe("when having effective promotion", () => {
            it("should update game config odds", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.gameConfigs = {
                    x: 123,
                    odds: { big: 10, small: 10 },
                    originalOdds: { big: 10, small: 10 },
                };
                const promotions = [];
                gameCron.promotionRepository = {
                    find: jest.fn(() => {
                        return {
                            lean: jest.fn(() => {
                                return {
                                    exec: jest.fn(() => promotions),
                                };
                            }),
                        };
                    }),
                };

                // Act
                await gameCron.updatePromotionOdds();

                // Assert
                expect(gameCron.gameData.gameConfigs.odds).toEqual({ big: 10, small: 11 });
            });

            it("should update boostedChoices", async () => {
                // Arrange
                const gameCron = createBaseGameCron();
                gameCron.gameData.gameConfigs = {
                    x: 123,
                    odds: { big: 10, small: 10 },
                    originalOdds: { big: 10, small: 10 },
                };
                const promotions = [];
                gameCron.promotionRepository = {
                    find: jest.fn(() => {
                        return {
                            lean: jest.fn(() => {
                                return {
                                    exec: jest.fn(() => promotions),
                                };
                            }),
                        };
                    }),
                };

                // Act
                await gameCron.updatePromotionOdds();

                // Assert
                expect(gameCron.gameData.gameConfigs.boostedChoices).toEqual(["small"]);
            });
        });
    });
});
