import RedeemConsumer from "../redeem-consumer";

describe("RedeemConsumer", () => {
    let redeemConsumer;
    let mockGameData;
    let mockDefinition;
    let mockLogService;
    let mockPublisher;
    let mockPromotionApiClient;

    beforeEach(() => {
        // Arrange - Setup mocks and dependencies
        mockGameData = {
            roundId: 123,
            remainingTime: 25,
            gameConfigs: {
                enabled: true,
            },
        };

        mockDefinition = {
            name: "test-game",
            choices: ["red", "black"],
        };

        mockLogService = {
            logInfo: jest.fn(),
            logError: jest.fn(),
            logWarning: jest.fn(),
        };

        mockPublisher = {
            publishToUser: jest.fn(),
        };

        mockPromotionApiClient = {
            redeemGiftCode: jest.fn(),
        };

        redeemConsumer = new RedeemConsumer({
            definition: mockDefinition,
            gameData: mockGameData,
            publisher: mockPublisher,
            logService: mockLogService,
            gamePromotionApiClient: mockPromotionApiClient,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("processRedeem", () => {
        it("should log processing information and send success response", async () => {
            // Arrange
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p1", operatorId: "op1", siteName: "site", currencyGroup: "cg" }
            };
            const payload = { giftCode: "VALID_CODE" };

            mockPromotionApiClient.redeemGiftCode.mockResolvedValue({ success: true });

            // Act
            await redeemConsumer.processRedeem(player, payload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                "player123",
                expect.objectContaining({
                    redeemResult: 1,
                    notice: expect.objectContaining({
                        errorCode: "REDEEM_SUCCESS",
                    }),
                })
            );
        });

        it("should handle invalid gift code", async () => {
            // Arrange
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p1", operatorId: "op1", siteName: "site", currencyGroup: "cg" }
            };
            const payload = { giftCode: "INVALID_CODE" };

            mockPromotionApiClient.redeemGiftCode.mockResolvedValue({ success: false, errorCode: "Invalide_gift_code_error_message", message: "Invalid Gift Code." });

            // Act
            await redeemConsumer.processRedeem(player, payload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                "player123",
                expect.objectContaining({
                    redeemResult: -1,
                    notice: expect.objectContaining({
                        errorCode: "Invalide_gift_code_error_message",
                        message: "Invalid Gift Code.",
                    }),
                })
            );
        });
    });

    describe("getNoticeObj", () => {
        it("should return notice object with error code", () => {
            // Act
            const result = redeemConsumer.getNoticeObj("TEST_ERROR");

            // Assert
            expect(result).toEqual({
                errorCode: "TEST_ERROR",
            });
        });

        it("should return notice object with error code and extra data", () => {
            // Act
            const result = redeemConsumer.getNoticeObj("TEST_ERROR", { message: "Test message" });

            // Assert
            expect(result).toEqual({
                errorCode: "TEST_ERROR",
                message: "Test message",
            });
        });
    });
}); 