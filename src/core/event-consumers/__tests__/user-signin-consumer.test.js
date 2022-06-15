import "jest-extended";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Socket } from "socket.io";
import UserSignInPublisher from "../../event-publishers/user-signin-publisher";
import GameData from "../../game-data";
import { PlayGamePermissionValidator } from "../../validators";
import UserSignInConsumer from "../user-signin-consumer";

import { Models, Payloads } from "jest-auto-fixture";

import * as baseApis from "sc-base-apis";

jest.mock("sc-base-apis");

const userServiceData = {
    signInGameResult: {
        data: {
            isSuccessful: true,
            user: {},
            userSession: {},
        },
        isSuccessful: true,
    },
};

jest.mock("../../helpers/authentication-helpers", () => {
    return {
        post: () => {
            return userServiceData.signInGameResult;
        },
    };
});

describe("UserSignInConsumer", () => {
    let payload, consumer;
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongoose(mongoose.Model);

    /** @type {PlayGamePermissionValidator}*/
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    /** @type {Socket} */
    const socketClient = stub(Socket);
    socketClient.request.headers = { "user-agent": "" };

    const appConfigs = { userServiceSettings: { url: "https://l1-proxy.lumigame.com/user" } };

    beforeEach(() => {
        jest.clearAllMocks();

        consumer = new UserSignInConsumer(gameData, userSignInPublisher, playGamePermissionValidator, appConfigs, userInfosRepository);
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

        describe("when verify session is false", () => {
            beforeEach(() => {
                payload = Payloads.SignIn();
                userServiceData.signInGameResult.isSuccessful = false;
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

        describe("when verify session is success", () => {
            const browserAgent = "chrome";
            let userSession;

            beforeEach(() => {
                payload = Payloads.SignIn({ username: "validUser", browserUserAgent: browserAgent });
                userServiceData.signInGameResult.isSuccessful = true;
                userSession = payload.ss;
                userInfosRepository.findOne().lean().exec.mockReturnValue(Models.UserInfo());

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
