import PromotionFreeSpinsConsumer from "../promotion-free-spins-consumer";

// Mock sc-common
jest.mock("sc-common", () => ({
    helpers: {
        noticeHelper: {
            invalidBet: "INVALID_BET",
        },
    },
}));

// No need to mock moment - it's a pure function!

describe("PromotionFreeSpinsConsumer", () => {
    let consumer;
    let mockGameData;
    let mockPromotionFreeSpinsPublisher;
    let mockLogService;
    let mockPromotionApiClient;

    beforeEach(() => {
        mockGameData = {
            gameConfigs: {
                gameId: "test-game-123",
            },
            realPlayers: {}, // Reset realPlayers for each test
        };

        mockPromotionFreeSpinsPublisher = {
            publishEndPromotion: jest.fn(),
            publishToUser: jest.fn(),
        };

        mockLogService = {
            logError: jest.fn(),
            log: jest.fn(),
        };

        mockPromotionApiClient = {
            getExpiringPromotions: jest.fn(),
            redeemGiftCode: jest.fn(),
            getPromotionById: jest.fn(),
        };

        consumer = new PromotionFreeSpinsConsumer({
            gameData: mockGameData,
            promotionFreeSpinsPublisher: mockPromotionFreeSpinsPublisher,
            logService: mockLogService,
            gamePromotionApiClient: {
                instance: () => mockPromotionApiClient,
            },
        });
    });

    describe("handlePromotionFreeSpinsExpiry", () => {
        beforeEach(() => {
            // Clear mock calls before each test
            jest.clearAllMocks();
        });

        it("should handle promotion expiry using realPlayers data", async () => {
            // Arrange - Use current time so promotions are expired "now"
            const now = new Date();
            const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

            consumer.gameData.realPlayers = {
                "socket-123": {
                    UID: "user123",
                    profile: { name: "john_doe" },
                    session: { playerId: "player1" },
                    socketClient: {},
                    promotion: {
                        promotionId: "promo1",
                        endDate: currentMinute.toISOString(), // Expires at current minute
                        totalWin: 150,
                    },
                },
                "socket-456": {
                    UID: "user456",
                    profile: { name: "jane_doe" },
                    session: { playerId: "player2" },
                    socketClient: {},
                    promotion: {
                        promotionId: "promo2",
                        endDate: currentMinute.toISOString(), // Expires at current minute
                        totalWin: 200,
                    },
                },
            };

            // Act
            await consumer.handlePromotionFreeSpinsExpiry();

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledWith([
                { playerId: "player1", totalWin: 150 },
                { playerId: "player2", totalWin: 200 },
            ]);
            expect(mockLogService.log).toHaveBeenCalledWith("Found 2 players with expired promotions");
        });

        it("should handle case when no players have expired promotions", async () => {
            // Arrange - Players with future end dates
            const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

            consumer.gameData.realPlayers = {
                "socket-123": {
                    UID: "user123",
                    profile: { name: "john_doe" },
                    session: { playerId: "player1" },
                    socketClient: {},
                    promotion: {
                        promotionId: "promo1",
                        endDate: futureTime.toISOString(), // Future time
                    },
                },
            };

            // Act
            await consumer.handlePromotionFreeSpinsExpiry();

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).not.toHaveBeenCalled();
        });

        it("should handle players without promotion data", async () => {
            // Arrange - Mixed players with and without promotions
            const now = new Date();
            const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

            consumer.gameData.realPlayers = {
                "socket-123": {
                    UID: "user123",
                    profile: { name: "john_doe" },
                    session: { playerId: "player1" },
                    socketClient: {},
                    // No promotion property
                },
                "socket-456": {
                    UID: "user456",
                    profile: { name: "jane_doe" },
                    session: { playerId: "player2" },
                    socketClient: {},
                    promotion: {
                        promotionId: "promo2",
                        endDate: currentMinute.toISOString(), // Expires at current minute
                        totalWin: 100,
                    },
                },
            };

            // Act
            await consumer.handlePromotionFreeSpinsExpiry();

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledWith([{ playerId: "player2", totalWin: 100 }]);
        });

        it("should handle empty realPlayers", async () => {
            // Arrange
            consumer.gameData.realPlayers = {};

            // Act
            await consumer.handlePromotionFreeSpinsExpiry();

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).not.toHaveBeenCalled();
        });

        it("should handle null realPlayers", async () => {
            // Arrange
            consumer.gameData.realPlayers = null;

            // Act
            await consumer.handlePromotionFreeSpinsExpiry();

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).not.toHaveBeenCalled();
        });
    });

    describe("isPromotionReady", () => {
        it("should return true when gameData.promotionReady is true", () => {
            // Arrange
            consumer.gameData.promotionReady = true;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when gameData.promotionReady is false", () => {
            // Arrange
            consumer.gameData.promotionReady = false;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when gameData.promotionReady is undefined", () => {
            // Arrange
            consumer.gameData.promotionReady = undefined;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when gameData.promotionReady is null", () => {
            // Arrange
            consumer.gameData.promotionReady = null;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("hasPromotionApiClient", () => {
        it("should return true when promotionApiClient is available", () => {
            // Arrange
            consumer.promotionApiClient = {};

            // Act
            const result = consumer.hasPromotionApiClient();

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when promotionApiClient is null", () => {
            // Arrange
            consumer.promotionApiClient = null;

            // Act
            const result = consumer.hasPromotionApiClient();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when promotionApiClient is undefined", () => {
            // Arrange
            consumer.promotionApiClient = undefined;

            // Act
            const result = consumer.hasPromotionApiClient();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("hasPlayersWithPromotions", () => {
        describe("when players have promotion data", () => {
            it("should return true for single player with active promotion", () => {
                // Arrange
                const realPlayersWithPromotion = {
                    "socket-123": {
                        UID: "user123",
                        profile: { name: "john_doe", minBet: 10, maxBet: 1000 },
                        session: { userId: "user123", operatorId: "op_001", playerId: "player123" },
                        socketClient: {},
                        promotion: {
                            promotionId: "promo_winter2024",
                            remainingBonusItems: 15,
                            isActive: true,
                            isClaimed: true,
                        },
                    },
                };
                consumer.gameData.realPlayers = realPlayersWithPromotion;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(true);
            });

            it("should return true when at least one player has promotion", () => {
                // Arrange
                const mixedPlayersWithPromotions = {
                    "socket-123": {
                        UID: "user123",
                        profile: { name: "john_doe" },
                        session: { userId: "user123" },
                        socketClient: {},
                        promotion: { promotionId: "promo_active", remainingBonusItems: 5 },
                    },
                    "socket-456": {
                        UID: "user456",
                        profile: { name: "jane_doe" },
                        session: { userId: "user456" },
                        socketClient: {},
                        promotion: { promotionId: "promo_completed", remainingBonusItems: 0 },
                    },
                    "socket-789": {
                        UID: "user789",
                        profile: { name: "bob_player" },
                        session: { userId: "user789" },
                        socketClient: {},
                    },
                };
                consumer.gameData.realPlayers = mixedPlayersWithPromotions;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(true);
            });
        });

        describe("when no players have promotion data", () => {
            it("should return false for players without promotions", () => {
                // Arrange
                const playersWithoutPromotions = {
                    "socket-123": {
                        UID: "user123",
                        profile: { name: "john_doe" },
                        session: { userId: "user123" },
                        socketClient: {},
                    },
                    "socket-456": {
                        UID: "user456",
                        profile: { name: "jane_doe" },
                        session: { userId: "user456" },
                        socketClient: {},
                    },
                };
                consumer.gameData.realPlayers = playersWithoutPromotions;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(false);
            });

            it("should return false when realPlayers is empty", () => {
                // Arrange
                consumer.gameData.realPlayers = {};

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(false);
            });

            it("should return false when realPlayers is null", () => {
                // Arrange
                consumer.gameData.realPlayers = null;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(false);
            });

            it("should return false when realPlayers is undefined", () => {
                // Arrange
                consumer.gameData.realPlayers = undefined;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(false);
            });
        });

        describe("when players have invalid promotion properties", () => {
            it("should return false for null promotion properties", () => {
                // Arrange
                const playersWithNullPromotions = {
                    "socket-123": {
                        UID: "user123",
                        profile: { name: "john_doe" },
                        session: { userId: "user123" },
                        socketClient: {},
                        promotion: null,
                    },
                    "socket-456": {
                        UID: "user456",
                        profile: { name: "jane_doe" },
                        session: { userId: "user456" },
                        socketClient: {},
                        promotion: undefined,
                    },
                };
                consumer.gameData.realPlayers = playersWithNullPromotions;

                // Act
                const result = consumer.hasPlayersWithPromotions();

                // Assert
                expect(result).toBe(false);
            });
        });
    });

    describe("checkExpiry", () => {
        beforeEach(() => {
            jest.spyOn(consumer, "isPromotionReady").mockReturnValue(true);
            jest.spyOn(consumer, "hasPlayersWithPromotions").mockReturnValue(true);
            jest.spyOn(consumer, "handlePromotionFreeSpinsExpiry").mockResolvedValue();
        });

        it("should exit early when promotion is not ready", async () => {
            // Arrange
            consumer.isPromotionReady.mockReturnValue(false);
            const gameId = "test-game-123";

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).not.toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).not.toHaveBeenCalled();
        });

        it("should exit early when no players have promotions", async () => {
            // Arrange
            consumer.hasPlayersWithPromotions.mockReturnValue(false);
            const gameId = "test-game-123";

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).not.toHaveBeenCalled();
        });

        it("should proceed with expiry check when minute changes", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(30);
            consumer.lastMinuteCheck = 29;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).toHaveBeenCalledWith();
            expect(consumer.lastMinuteCheck).toBe(30);
        });

        it("should skip expiry check when same minute", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(15);
            consumer.lastMinuteCheck = 15;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).not.toHaveBeenCalled();
        });

        it("should proceed when different minute", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(20);
            consumer.lastMinuteCheck = 19;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.handlePromotionFreeSpinsExpiry).toHaveBeenCalledWith();
            expect(consumer.lastMinuteCheck).toBe(20);
        });
    });

    describe("consume (redemption)", () => {
        const player = {
            UID: "player1",
            profile: { name: "testPlayer" },
            session: {
                operatorId: "op1",
                siteName: "site1",
                playerId: "p1",
                currencyGroupId: "cg1",
            },
        };

        const payload = {
            giftCode: "TEST_GIFT_CODE",
        };

        it("should exit early when promotion API is not ready", async () => {
            // Arrange
            jest.spyOn(consumer, "isPromotionReady").mockReturnValue(false);
            jest.spyOn(consumer, "publishRedemptionError");

            // Act
            await consumer.consume(player, payload);

            // Assert
            expect(consumer.publishRedemptionError).toHaveBeenCalledWith(player, "INVALID_BET", "Promotion system not available");
        });

        it("should process redeem when API is ready", async () => {
            // Arrange
            jest.spyOn(consumer, "isPromotionReady").mockReturnValue(true);
            jest.spyOn(consumer, "processRedeem").mockResolvedValue();

            // Act
            await consumer.consume(player, payload);

            // Assert
            expect(consumer.processRedeem).toHaveBeenCalledWith(player, payload);
        });

        it("should handle errors gracefully", async () => {
            // Arrange
            jest.spyOn(consumer, "isPromotionReady").mockReturnValue(true);
            jest.spyOn(consumer, "processRedeem").mockRejectedValue(new Error("API Error"));

            // Act
            await consumer.consume(player, payload);

            // Assert
            expect(mockLogService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error in promotion consumer for player"),
                expect.any(Error)
            );
        });
    });

    describe("processRedeem", () => {
        const player = {
            UID: "player1",
            session: {
                operatorId: "op1",
                siteName: "site1",
                playerId: "p1",
                currencyGroupId: "cg1",
            },
        };

        const payload = {
            giftCode: "TEST_GIFT_CODE",
        };

        it("should process successful redemption", async () => {
            // Arrange
            const mockResult = {
                success: true,
                promotion: {
                    promotionId: "promo1",
                    remainingBonusItems: 5,
                    initialBonusItem: 1,
                    promotionType: "FREE_SPINS",
                    endDate: "2024-12-31T23:59:59Z",
                    lastUsedDate: null,
                    isGiftCode: true,
                    betLevel: 1,
                },
            };

            mockPromotionApiClient.redeemGiftCode.mockResolvedValue(mockResult);
            jest.spyOn(consumer, "updatePromotion").mockResolvedValue();

            // Act
            await consumer.processRedeem(player, payload);

            // Assert
            expect(mockPromotionApiClient.redeemGiftCode).toHaveBeenCalledWith({
                giftCode: payload.giftCode,
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                playerId: player.session.playerId,
                currencyGroup: player.session.currencyGroupId,
                gameId: mockGameData.gameConfigs.gameId,
            });

            expect(consumer.updatePromotion).toHaveBeenCalledWith(player, mockResult);
            expect(mockPromotionFreeSpinsPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    redeemResult: 1,
                    promotion: expect.objectContaining({
                        promotionId: "promo1",
                        isClaimed: true,
                    }),
                })
            );
        });

        it("should handle failed redemption", async () => {
            // Arrange
            const mockResult = {
                success: false,
                code: "INVALID_CODE",
                message: "Gift code is invalid",
            };

            mockPromotionApiClient.redeemGiftCode.mockResolvedValue(mockResult);
            jest.spyOn(consumer, "publishRedemptionError");

            // Act
            await consumer.processRedeem(player, payload);

            // Assert
            expect(consumer.publishRedemptionError).toHaveBeenCalledWith(player, mockResult.code, mockResult.message);
        });
    });

    describe("updatePromotion", () => {
        const player = { session: {} };
        const result = {
            promotion: {
                promotionId: "promo1",
                promotionCode: "CODE123",
                remainingBonusItems: 5,
                initialBonusItem: 1,
                endDate: "2024-12-31T23:59:59Z",
                lastUsedDate: null,
                isGiftCode: true,
                betLevel: 1,
            },
        };

        it("should update player promotion when game is included", async () => {
            // Arrange
            const mockPromotionDetails = {
                gameIds: ["test-game-123", "other-game"],
            };

            mockPromotionApiClient.getPromotionById.mockResolvedValue(mockPromotionDetails);

            // Act
            await consumer.updatePromotion(player, result);

            // Assert
            expect(mockPromotionApiClient.getPromotionById).toHaveBeenCalledWith("promo1");
            expect(player.promotion).toEqual(
                expect.objectContaining({
                    promotionId: "promo1",
                    code: "CODE123",
                    isClaimed: true,
                })
            );
        });

        it("should not update player promotion when game is not included", async () => {
            // Arrange
            const mockPromotionDetails = {
                gameIds: ["other-game"],
            };

            mockPromotionApiClient.getPromotionById.mockResolvedValue(mockPromotionDetails);
            player.promotion = undefined;

            // Act
            await consumer.updatePromotion(player, result);

            // Assert
            expect(player.promotion).toBeUndefined();
        });
    });

    describe("publishRedemptionError", () => {
        it("should publish redemption error", () => {
            // Arrange
            const player = { UID: "player1" };
            const errorCode = "INVALID_CODE";
            const message = "Gift code is invalid";

            // Act
            consumer.publishRedemptionError(player, errorCode, message);

            // Assert
            expect(mockPromotionFreeSpinsPublisher.publishToUser).toHaveBeenCalledWith(player.UID, {
                redeemResult: -1,
                redemptionNotice: {
                    errorCode,
                    message,
                },
            });
        });
    });

    describe("getNoticeObj", () => {
        it("should create notice object with error code and extra data", () => {
            // Arrange
            const errorCode = "TEST_ERROR";
            const extraData = { message: "Test message", code: 123 };

            // Act
            const result = consumer.getNoticeObj(errorCode, extraData);

            // Assert
            expect(result).toEqual({
                errorCode,
                message: "Test message",
                code: 123,
            });
        });
    });

    describe("toYMDHM", () => {
        it("should format date correctly", () => {
            // Arrange
            const testDate = new Date("2024-01-01T12:30:45Z");

            // Act
            const result = consumer.toYMDHM(testDate);

            // Assert - Should format to YYYY-MM-DDTHH:mm (not round down minutes)
            expect(result).toBe("2024-01-01T12:30");
        });
    });
});
