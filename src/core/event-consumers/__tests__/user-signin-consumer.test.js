import "jest-extended";
import { stub } from "jest-micro-auto-stub";
import { Socket } from "socket.io";
import UserSignInPublisher from "../../event-publishers/user-signin-publisher";
import GameData from "../../game-data";
import { PlayGamePermissionValidator } from "../../validators";
import UserSignInConsumer from "../user-signin-consumer";
import { Payloads } from "jest-auto-fixture";
import * as baseApis from "sc-base-apis";
import GameManagementApiClientFactory from "../../game-management-api";

jest.mock("sc-base-apis");
jest.mock("sc-game-management-client");

const userServiceMock = {
    signInGameResult: {
        user: {},
        userSession: {},
    },
};

jest.mock("../../helpers/authentication-helpers", () => {
    return {
        post: () => {
            return userServiceMock.signInGameResult;
        },
    };
});

const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

describe("UserSignInConsumer", () => {
    let payload, consumer;
    const gameData = new GameData(0);

    /** @type {UserSignInPublisher}*/
    const userSignInPublisher = stub(UserSignInPublisher);

    /** @type {PlayGamePermissionValidator}*/
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    /** @type {Socket} */
    const socketClient = stub(Socket);
    socketClient.request.headers = { "user-agent": "" };

    const appConfigs = { userServiceSettings: { url: "https://l1-proxy.lumigame.com/user" } };

    beforeEach(() => {
        jest.clearAllMocks();

        consumer = new UserSignInConsumer(
            gameData,
            userSignInPublisher,
            playGamePermissionValidator,
            appConfigs,
            gameManagementApiClientFactory
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

        describe("when verify session is success", () => {
            const browserAgent = "chrome";
            let userSession;

            beforeEach(() => {
                payload = Payloads.SignIn({ username: "validUser", browserUserAgent: browserAgent });
                userSession = payload.ss;
                userServiceMock.signInGameResult = { id: userSession.userId };

                socketClient.request = { headers: { "user-agent": browserAgent } };

                baseApis.getBetLimit.mockReturnValue({
                    isOk: true,
                    response: {
                        minBet: 1,
                        maxBet: 100,
                    },
                });
            });

            describe("when not have user info", () => {
                it("should publish unauthorized message", async () => {
                    // Arrange
                    const data = { data: null, isSuccessful: true };
                    consumer.gameManagementApiClient.users.getUserInfo.mockReturnValueOnce(data);

                    // Act
                    await consumer.consume(socketClient, payload);

                    // Assert
                    expect(userSignInPublisher.publishUnauthorizedMessage).toBeCalledWith(socketClient);
                });
            });

            describe("when already have user info", () => {
                describe("when have play game permission", () => {
                    beforeEach(() => {
                        // Arrange
                        const data = { data: { id: 123 }, isSuccessful: true };
                        consumer.gameManagementApiClient.users.getUserInfo.mockResolvedValueOnce(data);
                        playGamePermissionValidator.validate.mockReturnValueOnce(true);
                    });

                    it("should update stake level", async () => {
                        // Act
                        await consumer.consume(socketClient, payload);

                        // Assert
                        expect(consumer.gameManagementApiClient.users.updateUserStakeLevel).toBeCalledWith({
                            id: userSession.userId,
                            minBet: 1,
                            maxBet: 100,
                        });
                    });

                    it("should public new stake level", async () => {
                        // arrange
                        const userStakeLevel = { minBet: 1, maxBet: 100 };

                        // Act
                        await consumer.consume(socketClient, payload);

                        // Assert
                        expect(socketClient.emit).toBeCalledWith("message", { userStakeLevel });
                    });

                    it("should publish signedIn message", async () => {
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

                        // Act
                        await consumer.consume(socketClient, payload);

                        // Assert
                        expect(gameData.realPlayers).toHaveProperty(socketClientId);
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
    });
});
