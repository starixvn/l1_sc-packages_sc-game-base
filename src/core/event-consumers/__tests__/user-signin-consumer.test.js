import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Socket } from "socket.io";

import UserSignInPublisher from "../../event-publishers/user-signin-publisher";
import GameData from "../../game-data";
import { PlayGamePermissionValidator } from "../../validators";
import UserSignInConsumer from "../user-signin-consumer";

jest.mock("sc-base-apis", () => ({
    getBetLimit: function () {
        return {
            isOk: true,
            response: {
                minBet: 1,
                maxBet: 100,
            },
        };
    },
}));

describe("user-signin-consumer", () => {
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {PlayGamePermissionValidator}*/
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    const consumer = new UserSignInConsumer(
        gameData,
        userSignInPublisher,
        userInfosRepository,
        userSessionsRepository,
        playGamePermissionValidator
    );

    /** @type {Socket} */
    const socketClient = stub(Socket);

    beforeEach(() => {});

    describe("consume", () => {
        describe("undefined/null payload", () => {
            it.each([undefined, null])("return undefined", async (payload) => {
                // act
                const result = await consumer.consume(socketClient, payload);

                // assert
                expect(result).toBeUndefined();
            });

            it.each([undefined, null])("publish unauthorized message", async (payload) => {
                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it.each([undefined, null])("disconnect the socket", async (payload) => {
                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("unexisting session ID", () => {
            it("publish unauthorized message", async () => {
                // arrange
                const payload = arrangeUnexistingSessionId();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // arrange
                const payload = arrangeUnexistingSessionId();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("unexisting userInfo", () => {
            it("publish unauthorized message to client", async () => {
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
        });

        describe("mismatching username between payload and stored session", () => {
            it("publish unauthorized message", async () => {
                // arrange
                const payload = arrangeMismatchUsername();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // arrange
                const payload = arrangeMismatchUsername();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("mismatching browser agent between payload and stored session", () => {
            it("publish unauthorized message", async () => {
                // arrange
                const payload = arrangeMismatchBrowserAgent();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // arrange
                const payload = arrangeMismatchBrowserAgent();

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("valid payload", () => {
            it("publish signedIn message", async () => {
                // arrange
                const { payload } = arrangeValidSession();
                spyOn(playGamePermissionValidator, "validate").and.returnValue(true);

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(socketClient.emit).toBeCalledWith("signedIn");
            });

            it("add to realPlayers", async () => {
                // arrange
                const { payload } = arrangeValidSession();
                const socketClientId = "socket id";

                gameData.realPlayers = [];
                socketClient.id = socketClientId;
                spyOn(playGamePermissionValidator, "validate").and.returnValue(true);

                // act
                await consumer.consume(socketClient, payload);

                // assert
                expect(gameData.realPlayers).toContainKey(socketClientId);
            });

            it("cached unique member", async () => {
                // arrange
                const { payload, userSession } = arrangeValidSession();
                const socketClientId = "socket id";

                gameData.realPlayers[socketClientId] = { UID: userSession.userId, socketClient: stub(Socket) };
                socketClient.id = socketClientId;

                // act
                await consumer.consume(socketClient, payload);

                // assert
                const allCachedRealPlayers = Object.values(gameData.realPlayers);

                expect(allCachedRealPlayers.filter((realPlayer) => realPlayer.UID === userSession.userId).length).toBe(1);
            });
        });
    });

    const arrangeUnexistingSessionId = () => {
        const payload = { ss: "unexisting ID" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(null);

        return payload;
    };

    const arrangeUnexistingUserInfo = () => {
        const payload = { ss: "valid ID but no associated userInfo" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce({ userId: "unexisting user ID" });
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce(null);

        return payload;
    };

    const arrangeMismatchUsername = () => {
        const payload = {
            ss: "any valid session ID",
            username: "username A",
        };
        const storedSession = {
            userId: "valid user ID",
            username: "username B",
        };
        const storedUserInfo = { name: "hello world" };

        userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(storedSession);
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce(storedUserInfo);

        return payload;
    };

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
