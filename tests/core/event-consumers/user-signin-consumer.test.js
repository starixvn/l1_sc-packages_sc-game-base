import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import socketIO from "socket.io";

import UserSignInConsumer from "./../../../src/core/event-consumers/user-signin-consumer";
import UserSignInPublisher from "./../../../src/core/event-publishers/user-signin-publisher";
import GameData from "./../../../src/core/game-data";

describe("user signing in testing", () => {
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModelStupidly(mongoose.Model);

    const consumer = new UserSignInConsumer(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository);

    /** @type {socketIO.Socket} */
    const socketClient = stub(socketIO.Socket);

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

    it("unexisting session ID makes the consumer publish unauthorized message to client", async () => {
        // arrange
        const payload = arrangeUnexistingSessionId();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });

    it("unexisting session ID makes the consumer disconnect the socket", async () => {
        // arrange
        const payload = arrangeUnexistingSessionId();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.disconnect).toHaveBeenCalled();
    });

    const arrangeUnexistingSessionId = () => {
        const payload = { ss: "unexisting ID" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(null);

        return payload;
    };

    it("unexisting userInfo makes the consumer publish unauthorized message to client", async () => {
        // arrange
        const payload = arrangeUnexistingUserInfo();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });

    it("unexisting userInfo makes the consumer disconnect the socket", async () => {
        // arrange
        const payload = arrangeUnexistingUserInfo();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.disconnect).toHaveBeenCalled();
    });

    const arrangeUnexistingUserInfo = () => {
        const payload = { ss: "valid ID but no associated userInfo" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce({ userId: "unexisting user ID" });
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce(null);

        return payload;
    };

    it("mismatching username between payload and stored session makes the consumer publish unauthorized message to client", async () => {
        // arrange
        const payload = arrangeMismatchUsername();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });

    it("mismatching username between payload and stored session makes the consumer disconnect the socket", async () => {
        // arrange
        const payload = arrangeMismatchUsername();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.disconnect).toHaveBeenCalled();
    });

    const arrangeMismatchUsername = () => {
        const payload = {
            ss: "any valid session ID",
            username: "username A",
        };
        const storedSession = {
            userId: "valid user ID",
            username: "username B",
        };
        const storedUserInfo = { name: "hello worlld" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(storedSession);
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce(storedUserInfo);

        return payload;
    };

    it("mismatching browser agent between payload and stored session makes the consumer publish unauthorized message to client", async () => {
        // arrange
        const payload = arrangeMismatchBrowserAgent();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
    });

    it("mismatching browser agent between payload and stored session makes the consumer disconnect the socket", async () => {
        // arrange
        const payload = arrangeMismatchBrowserAgent();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.disconnect).toHaveBeenCalled();
    });

    const arrangeMismatchBrowserAgent = () => {
        const payload = {
            ss: "any valid session ID",
            username: "username",
        };
        const storedSession = {
            userId: "valid user ID",
            username: "username",
            browserUserAgent: "chrome",
        };
        const storedUserInfo = { name: "hello worlld" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(storedSession);
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce(storedUserInfo);

        socketClient.request = { headers: { "user-agent": "firefox" } };

        return payload;
    };

    it("valid payload makes the consumer publish signIn message via the socket", async () => {
        // arrange
        const { payload } = arrangeValidSession();

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it("valid payload makes the consumer cache user's data and socket to the gameData", async () => {
        // arrange
        const { payload } = arrangeValidSession();
        const socketClientId = "socket id";

        gameData.realPlayers = [];
        socketClient.id = socketClientId;

        // act
        await consumer.consume(socketClient, payload);

        // assert
        expect(gameData.realPlayers).toContainKey(socketClientId);
    });

    it("valid payload makes the consumer ensure each member only takes one entry in the gameData", async () => {
        // arrange
        const { payload, userSession } = arrangeValidSession();
        const socketClientId = "socket id";

        gameData.realPlayers[socketClientId] = { UID: userSession.userId, socketClient: stub(socketIO.Socket) };
        socketClient.id = socketClientId;

        // act
        await consumer.consume(socketClient, payload);

        // assert
        const allCachedRealPlayers = Object.values(gameData.realPlayers);

        expect(allCachedRealPlayers.filter((realPlayer) => realPlayer.UID === userSession.userId).length).toBe(1);
    });

    const arrangeValidSession = (browserAgent = "chrome", storedBrowserAgent = "chrome") => {
        const payload = {
            ss: "any valid session ID",
            username: "username",
        };
        const storedSession = {
            userId: "valid user ID",
            username: "username",
            browserUserAgent: storedBrowserAgent,
        };
        const storedUserInfo = { name: "hello worlld" };

        userSessionsRepository.findOne().lean().exec.mockReturnValue(storedSession);
        userInfosRepository.findOne().lean().exec.mockReturnValue(storedUserInfo);

        socketClient.request = { headers: { "user-agent": browserAgent } };

        return { payload, userSession: storedSession, userInfo: storedUserInfo };
    };
});
