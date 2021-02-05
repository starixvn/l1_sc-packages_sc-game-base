import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import TableUserSignInConsumer from "../../../src/table/event-consumers/table-user-signin-consumer";
import TableUserSignInPublisher from "../../../src/table/event-publishers/table-user-signin-publisher";
import TableGameData from "../../../src/table/table-game-data";

describe("table user signin consumer in testing", () => {
    const gameData = new TableGameData(0);

    /** @type {TableUserSignInPublisher}*/
    const userSignInPublisher = stub(TableUserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModelStupidly(mongoose.Model);

    const consumer = new TableUserSignInConsumer(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository);

    /** @type {socketIO.Socket} */
    const socketClient = stub(socketIO.Socket);
});
