import { jest } from "@jest/globals";
import { when } from "jest-when";
import PlaceBetConsumer from "../place-bet-consumer.js";
import { helpers } from "sc-common";

// Mock external dependencies
jest.mock("sc-common", () => ({
    helpers: {
        noticeHelper: {
            invalidBet: "INVALID_BET",
            maxBetForChoice: "MAX_BET_FOR_CHOICE",
            minBet: "MIN_BET",
            maxBet: "MAX_BET",
            placeBetNextRound: "PLACE_BET_NEXT_ROUND",
            disallowHedgeBet: "DISALLOW_HEDGE_BET",
        },
    },
}));

jest.mock("sc-pf-client-seed", () => ({
    verifySeed: jest.fn(() => true),
}));

describe("PlaceBetConsumer with Promotion Integration", () => {
    let placeBetConsumer;
    let mockGameData;
    let mockDefinition;
    let mockPublisher;
    let mockLogService;

    beforeEach(() => {
        // Arrange - Setup mocks and dependencies
        mockGameData = {
            roundId: 123,
            remainingTime: 25,
            gameConfigs: {
                enabled: true,
                enableFreeBet: true,
            },
            currencyGroupGames: [
                {
                    groupId: "456",
                    minBet: 100,
                    maxBet: 10000,
                    maxBetPerChoices: { red: 5000, black: 5000 },
                },
            ],
            ingame: {},
        };

        mockDefinition = {
            choices: ["red", "black"],
            durations: {
                lockingBet: 5,
                placingBets: 30,
            },
            hedgeBetGroups: [["red", "black"]],
            provablyFair: true,
        };

        mockPublisher = {
            publishToUser: jest.fn(),
        };

        mockLogService = {
            logInfo: jest.fn(),
            logError: jest.fn(),
        };

        placeBetConsumer = new PlaceBetConsumer(mockDefinition, mockGameData, mockPublisher, mockLogService);

        // Mock getPromotionBetAmount to return 1 for promotion bets by default
        jest.spyOn(placeBetConsumer, "getPromotionBetAmount").mockReturnValue(1);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Regular Bet Placement", () => {
        it("should successfully place a regular bet", async () => {
            // Arrange
            const player = createMockPlayer();
            const betPayload = {
                betChoice: "red",
                amount: 500,
                freeBet: false,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockGameData.ingame[player.profile.name]).toBeDefined();
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
        });

        it("should reject bet when amount exceeds maximum", async () => {
            // Arrange
            const player = createMockPlayer();
            const betPayload = {
                betChoice: "red",
                amount: 15000,
                freeBet: false,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    betChoice: "red",
                    notice: expect.objectContaining({
                        errorCode: "MAX_BET_FOR_CHOICE",
                    }),
                })
            );
        });

        it("should reject bet when amount is below minimum", async () => {
            // Arrange
            const player = createMockPlayer();
            const betPayload = {
                betChoice: "red",
                amount: 50,
                freeBet: false,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "MIN_BET",
                    }),
                })
            );
        });
    });

    describe("Promotion Bet Placement", () => {
        it("should successfully place a promotion bet", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const betPayload = {
                betChoice: "red",
                amount: 100, // This will be auto-assigned to 1
                freeBet: false,
                freeSpin: true, // Must be true to activate promotion logic
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be auto-assigned to 1
            expect(betPayload.promotionId).toBe(player.promotion.promotionId);
        });

        it("should reject bet when no promotion is available (treated as regular bet)", async () => {
            // Arrange
            const player = createMockPlayer(); // No promotion data
            const betPayload = {
                betChoice: "red",
                amount: 0, // Invalid for regular bets
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert - Should fail as regular bet with invalid amount
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                    }),
                })
            );
        });

        it("should treat null promotion as regular bet", async () => {
            // Arrange
            const player = createMockPlayer();
            // Intentionally set promotion to null
            player.promotion = null;

            const betPayload = {
                betChoice: "red",
                amount: 0, // Invalid for regular bets
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert - Should fail as regular bet with invalid amount
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                    }),
                })
            );
        });

        it("should reject promotion when promotion has expired", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            player.promotion.endDate = yesterday.toISOString();

            const betPayload = {
                betChoice: "red",
                amount: 0,
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                        msg: "Promotion has expired",
                    }),
                })
            );
        });

        it("should reject promotion when promotion is not active", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            player.promotion.isActive = false;

            const betPayload = {
                betChoice: "red",
                amount: 0,
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                        msg: "Promotion is not active",
                    }),
                })
            );
        });

        it("should accept promotion when endDate is in the future", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            player.promotion.endDate = tomorrow.toISOString();

            const betPayload = {
                betChoice: "red",
                amount: 100, // This will be auto-assigned to 1
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be auto-assigned to 1
        });

        it("should accept promotion when no endDate is specified", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            delete player.promotion.endDate; // No end date specified

            const betPayload = {
                betChoice: "red",
                amount: 100, // This will be auto-assigned to 1
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be auto-assigned to 1
        });

        it("should use getPromotionBetAmount method for promotional bet amount", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const betPayload = {
                betChoice: "red",
                amount: 100,
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Override the getPromotionBetAmount method to return a custom amount
            const originalMethod = placeBetConsumer.getPromotionBetAmount;
            placeBetConsumer.getPromotionBetAmount = jest.fn().mockReturnValue(250);

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(placeBetConsumer.getPromotionBetAmount).toHaveBeenCalledWith(player, betPayload);
            expect(betPayload.amount).toBe(250); // Should use the overridden amount
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);

            // Restore original method
            placeBetConsumer.getPromotionBetAmount = originalMethod;
        });

        it("should allow game-specific promotional bet amounts via method override", async () => {
            // Arrange - Create a custom consumer class that overrides getPromotionBetAmount
            class SlotGamePlaceBetConsumer extends PlaceBetConsumer {
                getPromotionBetAmount(player, payload) {
                    // Slot game specific logic - could use player's last bet amount or fixed amount
                    return player.promotion?.promotionType === "FREE_SPIN" ? 500 : 0;
                }
            }

            const slotConsumer = new SlotGamePlaceBetConsumer(mockDefinition, mockGameData, mockPublisher, mockLogService);

            const player = createMockPlayerWithPromotion();
            const betPayload = {
                betChoice: "red",
                amount: 100,
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await slotConsumer.consume(player, betPayload);

            // Assert
            expect(betPayload.amount).toBe(500); // Should use slot-specific amount
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
        });

        it("should skip amount validation entirely for promotion bets", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const betPayload = {
                betChoice: "red",
                amount: 999999999, // Extremely high amount that would normally fail validation
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert - Should succeed despite invalid amount because promotion skips validation
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be overridden to promotional amount
        });

        it("should not validate freeBet enablement for promotion bets", async () => {
            // Arrange - Disable free bets but use promotion
            mockGameData.gameConfigs.enableFreeBet = false;
            const player = createMockPlayerWithPromotion();
            const betPayload = {
                betChoice: "red",
                amount: 100,
                freeBet: true, // This would normally fail validation
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert - Should succeed because promotion bets don't validate freeBet settings
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be overridden to promotional amount
        });

        it("should bypass min/max bet limits for promotion bets", async () => {
            // Arrange - Set very restrictive bet limits
            const player = createMockPlayerWithPromotion();
            player.profile.minBet = 1000;
            player.profile.maxBet = 2000;

            const betPayload = {
                betChoice: "red",
                amount: 50, // Below minimum bet
                freeBet: false,
                freeSpin: true,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert - Should succeed despite being below minimum bet
            expect(mockGameData.ingame[player.profile.name].betQueue).toHaveLength(1);
            expect(betPayload.amount).toBe(1); // Should be overridden to promotional amount
        });
    });

    describe("Edge Cases and Error Handling", () => {
        it("should handle unexpected errors in consume method", async () => {
            // Arrange
            const player = createMockPlayer();
            const betPayload = null; // This will cause an error

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockLogService.logError).toHaveBeenCalledWith(expect.stringContaining("Error in place bet consumer"), expect.any(Error));
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                    }),
                })
            );
        });
    });

    describe("Game Configuration Validation", () => {
        it("should reject bet when game is disabled", async () => {
            // Arrange
            mockGameData.gameConfigs.enabled = false;
            const player = createMockPlayer();
            const betPayload = {
                betChoice: "red",
                amount: 500,
                freeBet: false,
                clientSeed: "valid-seed",
            };

            // Act
            await placeBetConsumer.consume(player, betPayload);

            // Assert
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    notice: expect.objectContaining({
                        errorCode: "INVALID_BET",
                    }),
                })
            );
        });
    });

    describe("composeBetAmountValidationCriteria with Promotions", () => {
        it("should return empty array for promotion bets (no amount validation)", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();

            // Act
            const criteria = placeBetConsumer.composeBetAmountValidationCriteria(player, "red", 999999, true);

            // Assert
            expect(criteria).toEqual([]); // No validation criteria for promotion bets
        });

        it("should return validation criteria for regular bets", async () => {
            // Arrange
            const player = createMockPlayer(); // No promotion

            // Act
            const criteria = placeBetConsumer.composeBetAmountValidationCriteria(player, "red", 500, false);

            // Assert
            expect(criteria).toHaveLength(5); // Should have all normal validation criteria
            expect(criteria[0]).toHaveProperty("failure");
            expect(criteria[0]).toHaveProperty("notice");
        });

        it("should validate freeBet setting for regular bets but not promotion bets", async () => {
            // Arrange - Disable free bets
            mockGameData.gameConfigs.enableFreeBet = false;
            const regularPlayer = createMockPlayer();
            const promotionPlayer = createMockPlayerWithPromotion();

            // Act
            const regularCriteria = placeBetConsumer.composeBetAmountValidationCriteria(regularPlayer, "red", 500, true);
            const promotionCriteria = placeBetConsumer.composeBetAmountValidationCriteria(promotionPlayer, "red", 500, true);

            // Assert
            expect(regularCriteria[0].failure).toBe(true); // Should fail freeBet validation
            expect(promotionCriteria).toEqual([]); // Should skip all validation
        });
    });

    // Helper functions
    function createMockPlayer() {
        return {
            UID: "user123",
            profile: {
                name: "testPlayer",
                minBet: 100,
                maxBet: 5000,
            },
            session: {
                currencyGroupId: "456",
                currencyName: "USD",
                system: "test",
                operatorId: "op123",
                siteName: "testSite",
                playerId: "player123",
            },
        };
    }

    function createMockPlayerWithPromotion() {
        const player = createMockPlayer();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7); // 7 days in the future

        player.promotion = {
            promotionId: "promo123",
            code: "FREESPIN50",
            remainingBonusItems: 50,
            isActive: true,
            promotionType: "FREE_SPIN",
            endDate: futureDate.toISOString(),
            isClaimed: true,
        };
        return player;
    }
});
