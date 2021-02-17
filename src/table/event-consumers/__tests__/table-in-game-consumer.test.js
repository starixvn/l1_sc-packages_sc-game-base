import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import InGameConsumer from "../../../core/event-consumers/in-game-consumer";
import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import RoundQuery from "../../../core/query-apis/round-query";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableInGameConsumer from "../table-in-game-consumer";

describe("table in game consumer test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "name" });
    const gameData = new TableGameData(0);


    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
    const roundQuery = stub(RoundQuery);
    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);
    const getBalance = jest.fn();
    const consumer = new TableInGameConsumer(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);

    it("inherit InGameConsumer", () => {
        expect(consumer instanceof InGameConsumer)
    })

    it("buildPayload_always_calls Super", async () => {
        // arrange
        spyOn(InGameConsumer.prototype, "buildPayload");

        // act
        await consumer.buildPayload({ UID: "uid" });

        expect(InGameConsumer.prototype.buildPayload).toHaveBeenCalled();
    })


    it("consume_always_calls specific methods", async () => {
        // arrange
        const socketClient = {
            emit: jest.fn()
        }
        const user = {
            red: 1000,
            avatarId: 1,
            type: false
        }
        spyOn(consumer, "buildPayload").and.returnValue({ user });
        const realPlayer = {
            UID: "uid",
            profile: {
                name: "name"
            },
            socketClient
        };

        // act
        await consumer.consume(realPlayer);

        // assert
        expect(consumer.buildPayload).toHaveBeenCalled();
        expect(socketClient.emit).toHaveBeenCalled();
        expect(publisher.publishToAllUsersExcept).toHaveBeenCalled();
    })

});