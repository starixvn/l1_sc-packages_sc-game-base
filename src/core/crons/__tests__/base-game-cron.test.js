import SettleGameRoundConsumer from "../../event-consumers/settle-game-round-consumer";
import RunningRoundInfoPublisher from "../../event-publishers/running-round-info-publisher";
import GameStatusPublisher from "../../event-publishers/game-status-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import BaseBot from "../base-bot";
import { logger } from "sc-common";
import BaseGameCron from "../base-game-cron";
import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

jest.mock("../base-bot");
jest.mock("../../event-consumers/settle-game-round-consumer");
jest.mock("../../event-publishers/running-round-info-publisher");
jest.mock("../../event-publishers/game-status-publisher");

const gameData = new GameData(3);
const definition = new GameDefinition({ id: 1, name: "game name", durations: { lockingBet: 2, wholeRound: 30, placingBets: 25 } });
const bot = new BaseBot(gameData, definition);
const settleGameRoundConsumer = new SettleGameRoundConsumer();
const runningRoundInfoPublisher = new RunningRoundInfoPublisher();
const gameStatusPublisher = new GameStatusPublisher();

/** @type {logger}*/
const logService = stub(logger);

/** @type {mongoose.Model}*/
const gameConfigsRepository = stubMongooseModelStupidly(mongoose.Model);
gameConfigsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

describe("proceed tests", () => {
    it("should call checkGameStatus after each round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });

        baseGameCron.checkGameStatus = jest.fn();

        await baseGameCron.proceed();

        expect(baseGameCron.checkGameStatus).toHaveBeenCalled();
    });

    it("should call resetForNewRound and reset bot at starting round", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets + 1;

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });

        jest.spyOn(baseGameCron, "resetForNewRound");

        await baseGameCron.proceed();

        expect(bot.reset).toHaveBeenCalled();
        expect(baseGameCron.resetForNewRound).toHaveBeenCalled();
    });

    it("should call settleRound when remainingTime is less than 0", async () => {
        gameData.disabled = false;
        gameData.remainingTime = 0;

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });

        await baseGameCron.proceed();

        expect(gameData.remainingTime).toEqual(definition.durations.wholeRound);
        expect(settleGameRoundConsumer.settleRound).toHaveBeenCalledWith(gameData);
    });

    it("should call bot.run and runningRoundInfoPublisher.publish when remainting time is in placing bet time", async () => {
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.placingBets;

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });

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

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });


        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishStartGame).toHaveBeenCalled();
    });

    it("game is disabled, should reset gameData.remainingTime, update game configs and call publishDisableGameStatus", async () => {
        const gameConfigs = { enabled: false };
        gameData.disabled = false;
        gameData.remainingTime = definition.durations.wholeRound;
        gameConfigsRepository.findOne().lean().exec.mockReturnValueOnce(gameConfigs);

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });


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

        const baseGameCron = new BaseGameCron({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });


        await baseGameCron.checkGameStatus();

        expect(gameData.gameConfigs).toEqual(gameConfigs);
        expect(gameStatusPublisher.publishEnablingGameStatus).toHaveBeenCalled();
    });
});
