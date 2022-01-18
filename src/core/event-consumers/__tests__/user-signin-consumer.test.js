import "jest-extended";

import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Socket } from "socket.io";

import UserSignInPublisher from "../../event-publishers/user-signin-publisher";
import GameData from "../../game-data";
import { PlayGamePermissionValidator } from "../../validators";
import UserSignInConsumer from "../user-signin-consumer";

import { UserInfo, UserSession, SignInPayload } from "jest-auto-fixture";

import * as baseApis from "sc-base-apis";

jest.mock("sc-base-apis");

describe("UserSignInConsumer", () => {
    let payload, consumer;
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongoose(mongoose.Model);

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
        describe("when payload is undefined", () => {
            it("should return undefined", async () => {
                // Act
                const result = await consumer.consume(socketClient, undefined);

                // Assert
                expect(result).toBeUndefined();
            });

            it("should publish unauthorized message", async () => {
                // Act
                await consumer.consume(socketClient, undefined);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, undefined);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when payload is null", () => {
            it("should return undefined", async () => {
                // Act
                const result = await consumer.consume(socketClient, null);

                // Assert
                expect(result).toBeUndefined();
            });

            it("should publish unauthorized message", async () => {
                // Act
                await consumer.consume(socketClient, null);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, null);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when session is not exist", () => {
            beforeEach(() => {
                payload = SignInPayload();
                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(null);
            });

            it("should publish unauthorized message", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when userInfo is not exist", () => {
            beforeEach(() => {});

            it("should publish unauthorized message to client", async () => {
                // Arrange
                payload = SignInPayload();
                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(null);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when username is mismatched between payload and stored session", () => {
            beforeEach(() => {
                payload = SignInPayload();

                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(UserInfo());
            });

            it("should publish unauthorized message", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when browser agent is mismatched between payload and stored session", () => {
            beforeEach(() => {
                payload = SignInPayload();

                userSessionsRepository.findOne().lean().exec.mockReturnValueOnce(UserSession());
                userInfosRepository.findOne().lean().exec.mockReturnValueOnce(UserInfo());

                socketClient.request = { headers: { "user-agent": "firefox" } };
            });

            it("should publish unauthorized message", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            });

            it("should disconnect the socket", async () => {
                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.disconnect).toHaveBeenCalled();
            });
        });

        describe("when payload is valid", () => {
            const browserAgent = "chrome";
            let userSession;

            beforeEach(() => {
                payload = SignInPayload("validUser", browserAgent);
                userSession = payload.ss;

                userSessionsRepository.findOne().lean().exec.mockReturnValue(payload.ss);
                userInfosRepository.findOne().lean().exec.mockReturnValue(UserInfo());

                socketClient.request = { headers: { "user-agent": browserAgent } };

                baseApis.getBetLimit.mockReturnValue({
                    isOk: true,
                    response: {
                        minBet: 1,
                        maxBet: 100,
                    },
                });
            });

            it("should publish signedIn message", async () => {
                // Arrange
                playGamePermissionValidator.validate.mockReturnValueOnce(true);

                // Act
                await consumer.consume(socketClient, payload);

                // Assert
                expect(socketClient.emit).toBeCalledWith("signedIn");
            });

            it("should add to realPlayers", async () => {
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

            it("should cached unique member", async () => {
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
