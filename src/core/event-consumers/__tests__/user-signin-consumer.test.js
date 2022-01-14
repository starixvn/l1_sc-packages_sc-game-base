import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Socket } from "socket.io";

import UserSignInPublisher from "../../event-publishers/user-signin-publisher";
import GameData from "../../game-data";
import { PlayGamePermissionValidator } from "../../validators";
import UserSignInConsumer from "../user-signin-consumer";
import UserSignInFixture from "../__fixtures__/user-signin-fixture";

import * as baseApis from "sc-base-apis";

jest.mock("sc-base-apis");

describe("user-signin-consumer", () => {
    let payload, consumer;
    const gameData = new GameData(0);
    const fixture = new UserSignInFixture();

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {PlayGamePermissionValidator}*/
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    /** @type {Socket} */
    const socketClient = stub(Socket);

    beforeEach(() => {
        jest.clearAllMocks();

        consumer = new UserSignInConsumer(
            gameData,
            userSignInPublisher,
            userInfosRepository,
            userSessionsRepository,
            playGamePermissionValidator
        );
    });

    describe("consume", () => {
        describe("undefined/null payload", () => {
            it.each([undefined, null])("return undefined", async (payload) => {
                // Act
                const result = await consumer.consume(socketClient, payload);

                // Assert
                expect(result).toBeUndefined();
            });

            it.each([undefined, null])("publish unauthorized message", async (payload) => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it.each([undefined, null])("disconnect the socket", async (payload) => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("unexisting session ID", () => {
            it("publish unauthorized message", async () => {
                // Arrange
                const payload = fixture.SignInPayload();
                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(null);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // Arrange
                const payload = fixture.SignInPayload();
                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(null);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("unexisting userInfo", () => {
            beforeEach(() => {
                payload = fixture.SignInPayload();
                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(fixture.UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(null);
            });

            it("publish unauthorized message to client", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("unexisting userInfo makes the consumer disconnect the socket", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("mismatching username between payload and stored session", () => {
            beforeEach(() => {
                payload = fixture.SignInPayload();

                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(fixture.UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(fixture.UserInfo());
            });

            it("publish unauthorized message", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("mismatching browser agent between payload and stored session", () => {
            beforeEach(() => {
                payload = fixture.SignInPayload();

                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(fixture.UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(fixture.UserInfo());

                socketClient.request = { headers: { "user-agent": "firefox" } };
            });

            it("publish unauthorized message", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("disconnect the socket", async () => {
                // Arrange

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("valid payload", () => {
            const browserAgent = "chrome";
            let userSession;

            beforeEach(() => {
                payload = fixture.SignInPayload("validUser", browserAgent);
                userSession = payload.ss;

                userSessionsRepository.findOne().lean().exec.mockReturnValue(payload.ss);
                userInfosRepository.findOne().lean().exec.mockReturnValue(fixture.UserInfo());

                socketClient.request = { headers: { "user-agent": browserAgent } };

                baseApis.getBetLimit.mockReturnValue({
                    isOk: true,
                    response: {
                        minBet: 1,
                        maxBet: 100,
                    },
                });
            });

            it("publish signedIn message", async () => {
                // Arrange
                playGamePermissionValidator.validate.mockReturnValueOnce(true);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.emit).toBeCalledWith("signedIn");
            });

            it("add to realPlayers", async () => {
                // Arrange
                const socketClientId = "socket id";
                gameData.realPlayers = [];
                socketClient.id = socketClientId;
                playGamePermissionValidator.validate.mockReturnValueOnce(true);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(gameData.realPlayers).toContainKey(socketClientId);
            });

            it("cached unique member", async () => {
                // Arrange
                const socketClientId = "socket id";
                gameData.realPlayers[socketClientId] = { UID: userSession.userId, socketClient: stub(Socket) };
                socketClient.id = socketClientId;

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                const allCachedRealPlayers = Object.values(gameData.realPlayers);

                expect(allCachedRealPlayers.filter((realPlayer) => realPlayer.UID === userSession.userId).length).toBe(1);
            });
        });
    });
});
