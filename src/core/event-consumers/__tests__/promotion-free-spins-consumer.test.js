import PromotionFreeSpinsConsumer from "../promotion-free-spins-consumer";

// Mock moment
jest.mock("moment", () => {
    const mockMoment = {
        utc: jest.fn(() => ({
            format: jest.fn(() => "2024-01-01T12:00")
        }))
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
                        { playerId: "player2", totalWin: 200 }
                    ]
                }
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
                    players: [{ playerId: "player1", totalWin: 100 }]
                }
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
                    players: [{ playerId: "player1", totalWin: 100 }]
                },
                {
                    endDate: "2024-01-01T12:00:00Z", // Same time
                    players: [{ playerId: "player2", totalWin: 200 }]
                },
                {
                    endDate: "2024-01-01T13:00:00Z", // Different time
                    players: [{ playerId: "player3", totalWin: 300 }]
                }
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