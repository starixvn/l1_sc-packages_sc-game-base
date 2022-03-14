import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";

import SettleGameRoundConsumer from "../../event-consumers/settle-game-round-consumer";
import GameStatusPublisher from "../../event-publishers/game-status-publisher";
import RunningRoundInfoPublisher from "../../event-publishers/running-round-info-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import BaseBot from "../base-bot";
import BaseGameCron from "../base-game-cron";

jest.mock("../base-bot");
jest.mock("../../event-consumers/settle-game-round-consumer");
jest.mock("../../event-publishers/running-round-info-publisher");
jest.mock("../../event-publishers/game-status-publisher");

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

const initCron = function () {
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
    });
};

describe("proceed tests", () => {
    it("should call checkGameStatus after each round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;

        const baseGameCron = initCron();

        baseGameCron.checkGameStatus = jest.fn();

        await baseGameCron.proceed();

        expect(baseGameCron.checkGameStatus).toHaveBeenCalled();
    });

    it("should call resetForNewRound and reset bot at starting round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets + 1;

        const baseGameCron = initCron();

        jest.spyOn(baseGameCron, "resetForNewRound");

        await baseGameCron.proceed();

        expect(bot.reset).toHaveBeenCalled();
        expect(baseGameCron.resetForNewRound).toHaveBeenCalled();
    });

    it("should call settleRound when remainingTime is less than 0", async () => {
        gameData.disabled = false;
        gameData.remainingTime = 0;

        const baseGameCron = initCron();

        await baseGameCron.proceed();

        expect(gameData.remainingTime).toEqual(definition.durations.wholeRound);
        expect(settleGameRoundConsumer.settleRound).toHaveBeenCalledWith(gameData);
    });

    it("should call bot.run and runningRoundInfoPublisher.publish when remaining time is in placing bet time", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets;

        const baseGameCron = initCron();

        baseGameCron.checkGameStatus = jest.fn();

        await baseGameCron.proceed();

        expect(runningRoundInfoPublisher.publish).toHaveBeenCalled();
        expect(bot.run).toHaveBeenCalled();
    });
});

describe("checkGameStatus tests", () => {
    it("game is enabled, should update gameData.gameConfigs and call publishStartGame", async () => {
        const gameConfigs = { enabled: true };
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = initCron();

        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishStartGame).toHaveBeenCalled();
    });

    it("game is disabled, should reset gameData.remainingTime, update game configs and call publishDisableGameStatus", async () => {
        const gameConfigs = { enabled: false };
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = initCron();

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

        const baseGameCron = initCron();

        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishEnablingGameStatus).toHaveBeenCalled();
    });
});
