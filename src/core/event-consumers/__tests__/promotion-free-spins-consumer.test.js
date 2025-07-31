import PromotionFreeSpinsConsumer from "../promotion-free-spins-consumer";

// Mock moment
jest.mock("moment", () => {
    const mockMoment = {
        utc: jest.fn(() => ({
            format: jest.fn(() => "2024-01-01T12:00"),
        })),
    };
    return mockMoment;
});

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
        };

        mockPromotionFreeSpinsPublisher = {
            publishEndPromotion: jest.fn(),
        };

        mockLogService = {
            logError: jest.fn(),
            logInfo: jest.fn(),
        };

        mockPromotionApiClient = {
            getExpiringPromotions: jest.fn(),
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
        it("should handle promotion expiry for game successfully", async () => {
            // Arrange
            const gameId = "test-game-123";
            const mockPromotions = [
                {
                    endDate: "2024-01-01T12:00:00Z",
                    players: [
                        { playerId: "player1", totalWin: 100 },
                        { playerId: "player2", totalWin: 200 },
                    ],
                },
            ];

            mockPromotionApiClient.getExpiringPromotions.mockResolvedValue(mockPromotions);

            // Act
            await consumer.handlePromotionFreeSpinsExpiry(gameId);

            // Assert
            expect(mockPromotionApiClient.getExpiringPromotions).toHaveBeenCalledWith(gameId);
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledWith(mockPromotions[0].players);
        });

        it("should handle case when no expiring promotions found", async () => {
            // Arrange
            const gameId = "test-game-123";
            mockPromotionApiClient.getExpiringPromotions.mockResolvedValue([]);

            // Act
            await consumer.handlePromotionFreeSpinsExpiry(gameId);

            // Assert
            expect(mockPromotionApiClient.getExpiringPromotions).toHaveBeenCalledWith(gameId);
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).not.toHaveBeenCalled();
        });

        it("should handle case when promotion end date doesn't match current time", async () => {
            // Arrange
            const gameId = "test-game-123";
            const mockPromotions = [
                {
                    endDate: "2024-01-01T13:00:00Z", // Different time
                    players: [{ playerId: "player1", totalWin: 100 }],
                },
            ];

            mockPromotionApiClient.getExpiringPromotions.mockResolvedValue(mockPromotions);

            // Act
            await consumer.handlePromotionFreeSpinsExpiry(gameId);

            // Assert
            expect(mockPromotionApiClient.getExpiringPromotions).toHaveBeenCalledWith(gameId);
        });

        it("should handle multiple expiring promotions", async () => {
            // Arrange
            const gameId = "test-game-123";
            const mockPromotions = [
                {
                    endDate: "2024-01-01T12:00:00Z",
                    players: [{ playerId: "player1", totalWin: 100 }],
                },
                {
                    endDate: "2024-01-01T12:00:00Z", // Same time
                    players: [{ playerId: "player2", totalWin: 200 }],
                },
                {
                    endDate: "2024-01-01T13:00:00Z", // Different time
                    players: [{ playerId: "player3", totalWin: 300 }],
                },
            ];

            mockPromotionApiClient.getExpiringPromotions.mockResolvedValue(mockPromotions);

            // Act
            await consumer.handlePromotionFreeSpinsExpiry(gameId);

            // Assert
            expect(mockPromotionApiClient.getExpiringPromotions).toHaveBeenCalledWith(gameId);
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledTimes(3);
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledWith(mockPromotions[0].players);
            expect(mockPromotionFreeSpinsPublisher.publishEndPromotion).toHaveBeenCalledWith(mockPromotions[1].players);
        });
    });

    describe("isPromotionReady", () => {
        it("should return true when promotion API client is available", () => {
            // Arrange
            consumer.promotionApiClient = mockPromotionApiClient;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when promotion API client is null", () => {
            // Arrange
            consumer.promotionApiClient = null;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when promotion API client is undefined", () => {
            // Arrange
            consumer.promotionApiClient = undefined;

            // Act
            const result = consumer.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when gamePromotionApiClient is not injected", () => {
            // Arrange
            const consumerWithoutApi = new PromotionFreeSpinsConsumer({
                gameData: mockGameData,
                promotionFreeSpinsPublisher: mockPromotionFreeSpinsPublisher,
                logService: mockLogService,
                gamePromotionApiClient: null,
            });

            // Act
            const result = consumerWithoutApi.isPromotionReady();

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("hasPlayersWithPromotions", () => {
        it("should return true when players have promotions", () => {
            // Arrange
            consumer.gameData.ingame = {
                player1: { name: "player1", promotion: { promotionId: "promo1" } },
                player2: { name: "player2" },
            };

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when no players have promotions", () => {
            // Arrange
            consumer.gameData.ingame = {
                player1: { name: "player1" },
                player2: { name: "player2" },
            };

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when ingame is empty", () => {
            // Arrange
            consumer.gameData.ingame = {};

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when ingame is null", () => {
            // Arrange
            consumer.gameData.ingame = null;

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when ingame is undefined", () => {
            // Arrange
            consumer.gameData.ingame = undefined;

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when players have null promotions", () => {
            // Arrange
            consumer.gameData.ingame = {
                player1: { name: "player1", promotion: null },
                player2: { name: "player2", promotion: undefined },
            };

            // Act
            const result = consumer.hasPlayersWithPromotions();

            // Assert
            expect(result).toBe(false);
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

        it("should proceed with expiry check when conditions are met and timing is correct", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getSeconds").mockReturnValue(0);
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(30);
            consumer.lastMinuteCheck = 29;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).toHaveBeenCalledWith(gameId);
            expect(consumer.lastMinuteCheck).toBe(30);
        });

        it("should skip expiry check when same minute", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getSeconds").mockReturnValue(30);
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(15);
            consumer.lastMinuteCheck = 15;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.isPromotionReady).toHaveBeenCalled();
            expect(consumer.hasPlayersWithPromotions).toHaveBeenCalled();
            expect(consumer.handlePromotionFreeSpinsExpiry).not.toHaveBeenCalled();
        });

        it("should proceed when different minute even if not zero seconds", async () => {
            // Arrange
            const gameId = "test-game-123";
            jest.spyOn(Date.prototype, "getSeconds").mockReturnValue(45);
            jest.spyOn(Date.prototype, "getMinutes").mockReturnValue(20);
            consumer.lastMinuteCheck = 19;

            // Act
            await consumer.checkExpiry(gameId);

            // Assert
            expect(consumer.handlePromotionFreeSpinsExpiry).toHaveBeenCalledWith(gameId);
            expect(consumer.lastMinuteCheck).toBe(20);
        });
    });

    describe("toYMDHM", () => {
        it("should format date correctly", () => {
            // Arrange
            const testDate = new Date("2024-01-01T12:30:45Z");

            // Act
            const result = consumer.toYMDHM(testDate);

            // Assert
            expect(result).toBe("2024-01-01T12:00");
        });
    });
});
