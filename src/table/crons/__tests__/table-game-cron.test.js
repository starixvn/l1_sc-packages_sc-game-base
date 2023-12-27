import "jest-extended";

import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";

import BaseGameCron from "../../../core/crons/base-game-cron";
import SettleGameRoundConsumer from "../../../core/event-consumers/settle-game-round-consumer";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";
import TableGameCron from "../table-game-cron";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../../../core/event-publishers";
import GameManagementApiClientFactory from "./../../../core/game-management-api";

describe("table game cron test", () => {
    const definition = new TableGameDefinition({ name: "game name" });
    const gameData = new TableGameData(0);

    /** @type {TableGameBot}*/
    const bot = stub(TableGameBot);

    /** @type {SettleGameRoundConsumer}*/
    const settleGameRoundConsumer = stub(SettleGameRoundConsumer);

    /** @type {GameStatusPublisher}*/
    const gameStatusPublisher = stub(GameStatusPublisher);

    /** @type {RunningRoundInfoPublisher}*/
    const runningRoundInfoPublisher = stub(RunningRoundInfoPublisher);

    /** @type {logger}*/
    const logService = stub(logger);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

    /** @type {TableGameCron}*/
    const tableGameCron = new TableGameCron({
        definition: definition,
        gameData: gameData,
        bot: bot,
        settleGameRoundConsumer: settleGameRoundConsumer,
        gameStatusPublisher: gameStatusPublisher,
        runningRoundInfoPublisher: runningRoundInfoPublisher,
        logService: logService,
        roundsRepository: roundsRepository,
        gameManagementApiClientFactory,
    });

    it("inherit BaseGameCron", () => {
        expect(tableGameCron instanceof BaseGameCron);
    });

    describe("start", () => {
        it("should calls specific methods", async () => {
            // arrange
            spyOn(bot, "resetInRoomTrackings");
            spyOn(BaseGameCron.prototype, "start");

            // act
            await tableGameCron.start();

            // assert
            expect(bot.resetInRoomTrackings).toHaveBeenCalled();
            expect(BaseGameCron.prototype.start).toHaveBeenCalled();
        });
    });

    describe("resetForNewRound", () => {
        it("should calls super", () => {
            // arrange
            spyOn(BaseGameCron.prototype, "resetForNewRound");

            // act
            tableGameCron.resetForNewRound();

            // assert
            expect(BaseGameCron.prototype.resetForNewRound).toHaveBeenCalled();
            expect(gameData.chips).toEqual({});
            expect(gameData.winningPlayers).toEqual({});
        });
    });
});
