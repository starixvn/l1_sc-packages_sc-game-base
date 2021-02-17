import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import BaseBot from "../../../core/crons/base-bot";
import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";

describe("table game bot test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "game name" });
    const gameData = new TableGameData(0);

    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongooseModelStupidly(mongoose.Model);

    const bot = new TableGameBot(definition, gameData, publisher, userInfosRepository, tempBetsRepository);

    it("inherit base bot", () => {
        expect(bot instanceof BaseBot)
    })


})