import { stub, stubMongooseModel } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import SocketIO from "socket.io";

import UserSignInConsumer from "./../../../src/core/event-consumers/user-signin-consumer";
import UserSignInPublisher from "./../../../src/core/event-publishers/user-signin-publisher";
import GameData from "./../../../src/core/game-data";

describe("user signing in testing", () => {
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModel(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModel(mongoose.Model);

    const consumer = new UserSignInConsumer(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository);

    /** @type {SocketIO.Socket} */
    const socketClient = stub(SocketIO.Socket);

    it.each([undefined, null])("undefined/null payload makes the consume return undefined", async (payload) => {
        // act
        const result = await consumer.consume(socketClient, payload);

        // assert
        expect(result).toBeUndefined();
    });

    it.each([undefined, null])("undefined/null payload makes the consumer publish unauthorized message to client", async (payload) => {
        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });

    it.each([undefined, null])("undefined/null payload makes the consumer disconnect the socket", async (payload) => {
        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.disconnect).toHaveBeenCalled();
    });

    it("unexisting session ID makes the consumer publish unauthorized message to client ", async () => {
        // arrange
        const payload = {
            ss: "unexisting ID",
        };

        userSessionsRepository.findOne.mockReturnValueOnce(null);

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });
});
