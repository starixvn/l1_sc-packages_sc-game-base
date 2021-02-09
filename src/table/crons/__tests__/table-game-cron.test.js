import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";

import BaseGameCron from "../../../core/crons/base-game-cron";
import SettleGameRoundConsumer from "../../../core/event-consumers/settle-game-round-consumer";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";
import TableGameCron from "../table-game-cron";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "./../../../core/event-publishers";

jest.mock("../../../core/crons/base-game-cron")

describe("table game cron test", () => {
    const definition = new TableGameDefinition({ name: "game name" });
    const gameData = new TableGameData(0);
    const bot = stub(TableGameBot);
    const settleGameRoundConsumer = stub(SettleGameRoundConsumer);
    const gameStatusPublisher = stub(GameStatusPublisher);
    const runningRoundInfoPublisher = stub(RunningRoundInfoPublisher);
    const logService = stub(logger);
    /** @type {mongoose.Model}*/
    const gameConfigsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {TableGameCron}*/
    let tableGameCron;
    beforeEach(() => {
        tableGameCron = new TableGameCron({
            definition: definition,
            gameData: gameData,
            bot: bot,
            settleGameRoundConsumer: settleGameRoundConsumer,
            gameStatusPublisher: gameStatusPublisher,
            runningRoundInfoPublisher: runningRoundInfoPublisher,
            logService: logService,
            gameConfigsRepository: gameConfigsRepository,
            roundsRepository: roundsRepository
        })
    })


    it("inherit BaseGameCron", () => {
        expect(tableGameCron instanceof BaseGameCron)
    });
})