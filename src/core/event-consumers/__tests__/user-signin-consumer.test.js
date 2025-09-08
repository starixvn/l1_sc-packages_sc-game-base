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
import { PromotionClient } from "../../promotion-client";
import { signInGame as userServiceSignInGame } from "../../helpers/user-service-helpers";
import { getOrDefault } from "../../game-management-api";

jest.mock("sc-base-apis");
jest.mock("sc-game-management-client");
jest.mock("../../helpers/user-service-helpers");
jest.mock("../../game-management-api");
jest.mock("../../promotion-client");

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

    // Mock logService
    const mockLogService = {
        log: jest.fn(),
        logError: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Set up gameManagementApiClient mock for the consumer
        const mockApiClient = {
            users: {
                getUserInfo: jest.fn(),
                updateUserStakeLevel: jest.fn(),
            },
        };
        gameManagementApiClientFactory.instance.mockReturnValue(mockApiClient);

        consumer = new UserSignInConsumer({
            gameData,
            userSignInPublisher,
            playGamePermissionValidator,
            appConfigs,
            gameManagementApiClientFactory,
            logService: mockLogService,
        });

        // Note: claimPlayerPromotions is not mocked here to allow promotion integration tests to work
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

                // Also set up the new mock for userServiceSignInGame
                userServiceSignInGame.mockResolvedValue({ id: userSession.userId });

                // Set up getOrDefault mock for existing tests
                getOrDefault.mockResolvedValue({
                    name: "TestUser",
                    minBet: 1,
                    maxBet: 100,
                });

                socketClient.request = { headers: { "user-agent": browserAgent } };

                baseApis.getBetLimit.mockReturnValue(
                    Promise.resolve({
                        isOk: true,
                        response: {
                            minBet: 1,
                            maxBet: 100,
                        },
                    })
                );
            });

            describe("when not have user info", () => {
                it("should publish unauthorized message", async () => {
                    // Arrange
                    const data = { data: null, isSuccessful: true };
                    consumer.gameManagementApiClient.users.getUserInfo.mockReturnValueOnce(data);

                    // Mock getOrDefault to return null (no user info)
                    getOrDefault.mockResolvedValueOnce(null);

                    // Act
                    await consumer.consume(socketClient, payload);

                    // Assert
                    expect(userSignInPublisher.publishUnauthorizedMessage).toBeCalledWith(socketClient);
                });
            });

            describe("when already have user info", () => {
                describe("when have play game permission", () => {
                    beforeEach(() => {
                        // Arrange - Mock getUserInfo to return user data
                        const data = { data: { id: 123, name: "TestUser", minBet: 1, maxBet: 100 }, isSuccessful: true };
                        consumer.gameManagementApiClient.users.getUserInfo.mockResolvedValueOnce(data);

                        // Mock getOrDefault to return the user data
                        getOrDefault.mockResolvedValueOnce({
                            name: "TestUser",
                            minBet: 1,
                            maxBet: 100,
                        });

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
                        const socketClientId2 = "socket id 2";
                        const socketClient2 = {
                            id: socketClientId2,
                            disconnect: jest.fn(),
                        };

                        gameData.realPlayers = {};
                        gameData.realPlayers[socketClientId2] = { UID: userSession.userId, socketClient: socketClient2 };
                        socketClient.id = socketClientId;

                        // Act
                        await consumer.consume(socketClient, payload);

                        // Assert
                        expect(socketClient2.disconnect).toBeCalledWith(true);
                        expect(gameData.realPlayers).not.toHaveProperty(socketClientId2);
                        expect(gameData.realPlayers).toHaveProperty(socketClientId);
                    });
                });
            });
        });
    });

    // Promotion Integration Tests
    describe("Promotion Integration", () => {
        let mockGamePromotionApiClient;
        let mockPromotionApiInstance;
        let consumerWithPromotion;

        beforeEach(() => {
            // Mock the actual promotion API instance methods
            mockPromotionApiInstance = {
                claimPromotion: jest.fn(),
                getRunningPromotions: jest.fn(),
                getTotalWin: jest.fn(),
                getPromotionById: jest.fn(),
            };

            // Mock GamePromotionApiClient (the factory)
            mockGamePromotionApiClient = {
                instance: jest.fn().mockReturnValue(mockPromotionApiInstance),
                isAvailable: jest.fn().mockReturnValue(true),
            };

            // Set up gameManagementApiClient mock for the promotion consumer
            const mockApiClient = {
                users: {
                    getUserInfo: jest.fn(),
                    updateUserStakeLevel: jest.fn(),
                },
            };
            gameManagementApiClientFactory.instance.mockReturnValue(mockApiClient);

            // Set up gameData with gameConfigs for promotion tests
            gameData.gameConfigs = { gameId: "test-game-123" };
            
            // Set up promotions array for promotion availability checks
            gameData.promotions = [
                {
                    promotionId: "promo123",
                    startDate: new Date("2020-01-01T00:00:00Z"),
                    endDate: new Date("2025-12-31T23:59:59Z"),
                    claimPlayerPromotions: new Date("2025-12-31T23:59:59Z"), // Match current logic
                    gameIds: ["test-game-123", "other-game-456"],
                    operatorId: "OP001",
                    offeredSiteNames: ["test-site"],
                    offeredPlayerIds: ["player456"],
                    currencyGroups: ["USD_GROUP_1"]
                }
            ];

            // Create consumer with promotion client
            consumerWithPromotion = new UserSignInConsumer({
                gameData,
                userSignInPublisher,
                playGamePermissionValidator,
                appConfigs: {
                    ...appConfigs,
                    promotionApiSettings: {
                        baseUrl: "https://promotion-api.test.com",
                        timeout: 5000,
                        useAuthentication: true,
                    },
                },
                gameManagementApiClientFactory,
                logService: mockLogService,
                gamePromotionApiClient: mockGamePromotionApiClient,
            });

            // Mock external functions with player-specific data
            userServiceSignInGame.mockResolvedValue({
                id: "user123",
                memberName: "TestPlayer",
                playerId: "player456",
                operatorId: "OP001",
                siteName: "test-site",
                currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId instead of currencyGroup
            });

            // Mock isPromotionAvailable method to always return true for tests
            jest.spyOn(consumerWithPromotion, 'isPromotionAvailable').mockReturnValue(true);

            getOrDefault.mockResolvedValue({
                name: "TestPlayer",
                minBet: 1,
                maxBet: 1000,
            });

            baseApis.getBetLimit.mockResolvedValue({
                isOk: true,
                response: {
                    minBet: 1,
                    maxBet: 1000,
                },
            });
        });

        describe("claimPlayerPromotions", () => {
            it("should successfully claim promotion and return promotion data", async () => {
                const mockPromotionResult = {
                    promotion: {
                        promotionId: "promo123",
                        promotionCode: "FREE_SPIN",
                        remainingBonusItems: 10,
                        initialBonusItem: 15,
                        promotionType: "FREE_SPIN",
                        endDate: new Date("2025-12-31T23:59:59Z"),
                        lastUsedDate: "2024-01-01T00:00:00Z",
                        isGiftCode: false,
                    },
                };

                mockPromotionApiInstance.claimPromotion.mockResolvedValue(mockPromotionResult);
                mockPromotionApiInstance.getRunningPromotions.mockResolvedValue([]);
                mockPromotionApiInstance.getTotalWin.mockResolvedValue(100);
                mockPromotionApiInstance.getPromotionById.mockResolvedValue({
                    gameIds: ["test-game-123", "other-game-456"],
                });

                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                const result = await consumerWithPromotion.claimPlayerPromotions(userSession);

                expect(mockPromotionApiInstance.claimPromotion).toHaveBeenCalledWith({
                    operatorId: "OP001",
                    siteName: "test-site",
                    gameId: "test-game-123",
                    playerId: "player456",
                    currencyGroup: "USD_GROUP_1", // ✅ Fixed: Expect currencyGroupId value
                });

                expect(result).toEqual({
                    promotion: {
                        promotionId: "promo123",
                        remainingBonusItems: 10,
                        initialBonusItem: 15,
                        isActive: true,
                        promotionType: "FREE_SPIN",
                        endDate: new Date("2025-12-31T23:59:59Z"),
                        lastUsedDate: "2024-01-01T00:00:00Z",
                        isGiftCode: false,
                        totalWin: 100,
                        isClaimed: true,
                    },
                });
            });

            it("should return null when no promotion is available", async () => {
                mockPromotionApiInstance.claimPromotion.mockResolvedValue(null);

                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                const result = await consumerWithPromotion.claimPlayerPromotions(userSession);

                expect(result).toBeNull();
                expect(mockLogService.log).toHaveBeenCalledWith(
                    'Claiming promotion for player {"operatorId":"OP001","siteName":"test-site","playerId":"player456","currencyGroup":"USD_GROUP_1","gameId":"test-game-123"}'
                );
            });

            it("should return null when promotion API client is not available", async () => {
                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                // Use consumer without promotion client (null)
                const result = await consumer.claimPlayerPromotions(userSession);

                expect(result).toBeNull();
                expect(mockLogService.log).not.toHaveBeenCalled();
            });

            it("should return null when promotion settings are not configured", async () => {
                const consumerWithoutSettings = new UserSignInConsumer({
                    gameData,
                    userSignInPublisher,
                    playGamePermissionValidator,
                    appConfigs, // No promotionApiSettings
                    gameManagementApiClientFactory,
                    logService: mockLogService,
                    gamePromotionApiClient: mockGamePromotionApiClient, // Client is available but settings are not
                });

                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                const result = await consumerWithoutSettings.claimPlayerPromotions(userSession);

                expect(result).toBeNull();
                expect(mockLogService.log).not.toHaveBeenCalled();
            });

            it("should handle API errors gracefully", async () => {
                const apiError = new Error("API connection failed");
                mockPromotionApiInstance.claimPromotion.mockRejectedValue(apiError);

                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                const result = await consumerWithPromotion.claimPlayerPromotions(userSession);

                expect(result).toBeNull();
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    "Failed to claim promotion for player player456: API connection failed"
                );
            });

            it("should return null when required player data is missing", async () => {
                const userSessionMissingData = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    // Missing siteName and currencyGroup
                };

                const result = await consumerWithPromotion.claimPlayerPromotions(userSessionMissingData);

                expect(result).toBeNull();
                expect(mockPromotionApiInstance.claimPromotion).not.toHaveBeenCalled();
            });

            it("should calculate isActive based on expiry date", async () => {
                const expiredPromotionResult = {
                    promotion: {
                        promotionId: "promo123",
                        promotionCode: "EXPIRED",
                        remainingBonusItems: 5,
                        promotionType: "FREE_SPIN",
                        endDate: new Date("2020-01-01T00:00:00Z"), // Expired date
                        lastUsedDate: "2019-12-01T00:00:00Z",
                        isGiftCode: false,
                    },
                };

                mockPromotionApiInstance.claimPromotion.mockResolvedValue(expiredPromotionResult);
                mockPromotionApiInstance.getRunningPromotions.mockResolvedValue([]);
                mockPromotionApiInstance.getTotalWin.mockResolvedValue(0);
                mockPromotionApiInstance.getPromotionById.mockResolvedValue({
                    gameIds: ["test-game-123", "other-game-456"],
                });

                const userSession = {
                    userId: "user123",
                    playerId: "player456",
                    operatorId: "OP001",
                    siteName: "test-site",
                    currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                };

                const result = await consumerWithPromotion.claimPlayerPromotions(userSession);

                expect(result.promotion.isActive).toBe(false); // ✅ Should be false for expired date
            });
        });

        describe("consume - Full Sign-In Flow with Promotions", () => {
            let mockSocketClient;

            beforeEach(() => {
                mockSocketClient = {
                    id: "socket123",
                    emit: jest.fn(),
                    disconnect: jest.fn(),
                    request: {
                        headers: {
                            "user-agent": "test-browser",
                        },
                    },
                };

                playGamePermissionValidator.validate.mockReturnValue(true);
                consumerWithPromotion.gameManagementApiClient.users.getUserInfo.mockResolvedValue({
                    data: { name: "TestPlayer", minBet: 1, maxBet: 1000 },
                    isSuccessful: true,
                });
            });

            it("should complete sign-in with promotion data", async () => {
                const mockPromotionResult = {
                    promotion: {
                        promotionId: "promo123",
                        promotionCode: "FREE_SPIN",
                        remainingBonusItems: 5,
                        initialBonusItem: 15,
                        promotionType: "FREE_SPIN",
                        endDate: new Date("2025-12-31T23:59:59Z"),
                        lastUsedDate: "2024-01-01T00:00:00Z",
                        isGiftCode: false,

                        totalWin: 50,
                        isUsePromotion: true,
                    },
                };

                mockPromotionApiInstance.claimPromotion.mockResolvedValue(mockPromotionResult);
                mockPromotionApiInstance.getRunningPromotions.mockResolvedValue([]);
                mockPromotionApiInstance.getTotalWin.mockResolvedValue(50);
                mockPromotionApiInstance.getPromotionById.mockResolvedValue({
                    gameIds: ["test-game-123", "other-game-456"],
                });

                const payload = {
                    ss: "session123",
                    username: "testuser",
                };

                await consumerWithPromotion.consume(mockSocketClient, payload);

                expect(mockPromotionApiInstance.claimPromotion).toHaveBeenCalled();

                expect(gameData.realPlayers[mockSocketClient.id]).toEqual({
                    UID: "user123",
                    profile: { name: "TestPlayer", minBet: 1, maxBet: 1000 },
                    session: {
                        browserUserAgent: "test-browser",
                        id: "user123",
                        memberName: "TestPlayer",
                        userId: "user123",
                        playerName: "TestPlayer",
                        characterName: "TestPlayer",
                        playerId: "player456",
                        operatorId: "OP001",
                        siteName: "test-site",
                        currencyGroupId: "USD_GROUP_1", // ✅ Fixed: Use currencyGroupId
                    },
                    socketClient: mockSocketClient,
                    promotion: {
                        promotionId: "promo123",
                        remainingBonusItems: 5,
                        initialBonusItem: 15,
                        isActive: true,
                        promotionType: "FREE_SPIN",
                        endDate: new Date("2025-12-31T23:59:59Z"),
                        lastUsedDate: "2024-01-01T00:00:00Z",
                        isGiftCode: false,

                        totalWin: 50,
                        isClaimed: true,
                    },
                });

                expect(mockSocketClient.emit).toHaveBeenCalledWith("signedIn");
            });

            it("should complete sign-in without promotion data when no promotion available", async () => {
                mockPromotionApiInstance.claimPromotion.mockResolvedValue(null);

                const payload = {
                    ss: "session123",
                    username: "testuser",
                };

                await consumerWithPromotion.consume(mockSocketClient, payload);

                expect(gameData.realPlayers[mockSocketClient.id].promotion).toBeUndefined();
                expect(mockSocketClient.emit).toHaveBeenCalledWith("signedIn");
            });
        });
    });
});
