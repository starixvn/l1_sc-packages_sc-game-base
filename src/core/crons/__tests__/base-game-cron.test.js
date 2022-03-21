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

jest.mock("../base-bot");
jest.mock("../../event-consumers/settle-game-round-consumer");
jest.mock("../../event-publishers/running-round-info-publisher");
jest.mock("../../event-publishers/game-status-publisher");
jest.mock("cron");

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

const roundResultConsumer = { generateResultAndPublishMD5: jest.fn() };

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
    });
};

describe("start", () => {
    it("call initRoundId", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastMD5 = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.initRoundId).toHaveBeenCalledWith();
    });

    it("call querylastMD5", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastMD5 = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.queryLastMD5).toHaveBeenCalledWith();
    });

    it("call getSettingForNewRound", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastMD5 = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.getSettingForNewRound).toHaveBeenCalledWith();
    });

    it("call updateExchangeRates", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastMD5 = jest.fn();
        gameCron.getSettingForNewRound = jest.fn();
        gameCron.updateExchangeRates = jest.fn();
        gameCron.startCron = jest.fn();

        // Act
        await gameCron.start();

        // Assert
        expect(gameCron.updateExchangeRates).toHaveBeenCalledWith();
    });

    it("call startCron", async () => {
        // Arrange
        var gameCron = createBaseGameCron();
        gameCron.initRoundId = jest.fn();
        gameCron.queryLastMD5 = jest.fn();
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
        it("roundid = last round id + 1", async () => {
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
        it("get round id from archiveRound", async () => {
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

describe("queryLastMD5", () => {
    describe("when md5sRepository is null", () => {
        it("do not update lastMD5Record", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            gameCron.md5sRepository = null;

            // Act
            await gameCron.queryLastMD5();

            // Assert
            expect(gameCron.gameData.lastMD5Record).toBe(undefined);
        });
    });

    describe("when md5sRepository exists", () => {
        it("find lastMD5Record", async () => {
            // Arrange
            const gameCron = createBaseGameCron();
            const lastMD5Record = { x: 1 };
            gameCron.md5sRepository = { findOne: jest.fn() };
            const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(lastMD5Record) }) };
            when(gameCron.md5sRepository.findOne).calledWith({ roundId: 123 }).mockReturnValue(findOneResult);
            gameCron.gameData.roundId = 123;

            // Act
            await gameCron.queryLastMD5();

            // Assert
            expect(gameCron.gameData.lastMD5Record).toBe(lastMD5Record);
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
        it("call proceed", () => {
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

        it("call catch", () => {
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
        it("log error", () => {
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

        it("call start job", () => {
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

xdescribe("proceed tests", () => {
    it("should call checkGameStatus after each round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;

        const baseGameCron = createBaseGameCron();

        baseGameCron.checkGameStatus = jest.fn();

        await baseGameCron.proceed();

        expect(baseGameCron.checkGameStatus).toHaveBeenCalled();
    });

    it("should call resetForNewRound and reset bot at starting round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets + 1;

        const baseGameCron = createBaseGameCron();

        jest.spyOn(baseGameCron, "resetForNewRound");

        await baseGameCron.proceed();

        expect(bot.reset).toHaveBeenCalled();
        expect(baseGameCron.resetForNewRound).toHaveBeenCalled();
    });

    it("should call settleRound when remainingTime is less than 0", async () => {
        gameData.disabled = false;
        gameData.remainingTime = 0;

        const baseGameCron = createBaseGameCron();

        await baseGameCron.proceed();

        expect(gameData.remainingTime).toEqual(definition.durations.wholeRound);
        expect(settleGameRoundConsumer.settleRound).toHaveBeenCalledWith(gameData);
    });

    it("should call bot.run and runningRoundInfoPublisher.publish when remaining time is in placing bet time", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets;

        const baseGameCron = createBaseGameCron();

        baseGameCron.checkGameStatus = jest.fn();

        await baseGameCron.proceed();

        expect(runningRoundInfoPublisher.publish).toHaveBeenCalled();
        expect(bot.run).toHaveBeenCalled();
    });
});

xdescribe("checkGameStatus tests", () => {
    it("game is enabled, should update gameData.gameConfigs and call publishStartGame", async () => {
        const gameConfigs = { enabled: true };
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = createBaseGameCron();

        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishStartGame).toHaveBeenCalled();
    });

    it("game is disabled, should reset gameData.remainingTime, update game configs and call publishDisableGameStatus", async () => {
        const gameConfigs = { enabled: false };
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = createBaseGameCron();

        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameData.remainingTime).toEqual(definition.durations.wholeRound);
        expect(gameConfigsRepository.updateOne).toHaveBeenCalled();
        expect(gameStatusPublisher.publishDisableGameStatus).toHaveBeenCalled();
    });

    it("game is currently disabled, then being enabled, should call publishEnablingGameStatus", async () => {
        const gameConfigs = { enabled: true };
        gameData.disabled = true;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = createBaseGameCron();

        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishEnablingGameStatus).toHaveBeenCalled();
    });
});
