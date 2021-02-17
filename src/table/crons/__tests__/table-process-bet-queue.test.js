import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";

import ProcessBetQueue from "../../../core/crons/process-bet-queue";
import PlaceBetPublisher from "../../event-publishers/table-place-bet-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableProcessBetQueue from "../table-process-bet-queue";

describe("table process bet queue test", () => {
    const definition = new TableGameDefinition({ name: "game name" });
    const gameData = new TableGameData(0);
    const placeBetPublisher = stub(PlaceBetPublisher);
    const placeBet = jest.fn();
    const logService = stub(logger);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betLogsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    const betQueue = new TableProcessBetQueue({ definition, gameData, placeBetPublisher, placeBet, logService, betsRepository, betLogsRepository, userInfosRepository })

    it("inherit ProcessBetQueue", () => {
        expect(betQueue instanceof ProcessBetQueue)
    })

    it("generatePlacingBetResult_always_calls super", () => {
        // arrange
        const socketClient = {
            emit: jest.fn()
        }
        const player = {
            UID: "uid",
            profile: {
                name: "name"
            },
            socketClient
        };
        const ownBet = {
            ownBets: {},
            endBet: 10,
            freeBet: false,
            user: { red: 2000 },
        };
        spyOn(ProcessBetQueue.prototype, "generatePlacingBetResult").and.returnValue(ownBet);

        // act
        betQueue.generatePlacingBetResult(player, 2000, 10);

        // assert
        expect(ProcessBetQueue.prototype.generatePlacingBetResult).toHaveBeenCalledWith(player, 2000, 10);
    })
})