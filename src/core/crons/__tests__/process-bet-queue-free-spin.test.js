import { jest } from "@jest/globals";
import { when } from "jest-when";
import ProcessBetQueue from "../process-bet-queue.js";

// Mock external dependencies
jest.mock("sc-common", () => ({
    helpers: {
        noticeHelper: {
            placeBetNextRound: "PLACE_BET_NEXT_ROUND",
            notEnoughScoin: "NOT_ENOUGH_SCOIN",
        },
    },
}));

jest.mock("sc-instrument", () => ({
    tracer: {
        startActiveSpan: jest.fn((name, callback) => {
            const mockSpan = { end: jest.fn() };
            return callback(mockSpan);
        }),
    },
}));

describe("ProcessBetQueue with Promotion Integration", () => {
    let processBetQueue;
    let mockDependencies;

    beforeEach(() => {
        // Setup all mock dependencies
        const mockCreatePromotionTicket = jest.fn();
        const mockRollbackBonusItem = jest.fn();
        const mockDeductBonusItem = jest.fn();

        mockDependencies = {
            definition: {
                id: "game123",
                name: "Test Game",
                type: "casino",
                choicesMapper: { red: 1, black: 2 },
                durations: {
                    lockingBet: 5,
                    placingBets: 30,
                },
            },
            gameData: {
                roundId: 456,
                remainingTime: 25,
                gameConfigs: { odds: { red: 2.0, black: 2.0 } },
                exchangeRates: { code: { USD: 1.0 } },
                currencies: [
                    {
                        partnerId: "op123",
                        name: "USD",
                        isTest: false,
                        isUncountOnTotal: false,
                    },
                ],
                ingame: {},
                totalBets: {},
            },
            placeBetPublisher: {
                publishSuccessBet: jest.fn(),
                publishGameFailedBet: jest.fn(),
                publishToUser: jest.fn(),
            },
            placeBet: jest.fn(),
            logService: {
                logInfo: jest.fn(),
                logError: jest.fn(),
            },
            betsRepository: {
                updateOne: jest.fn(),
            },
            betLogsRepository: {
                create: jest.fn(),
            },
            gameManagementApiClientFactory: {
                instance: jest.fn(() => ({
                    users: {
                        getUserScoins: jest.fn().mockResolvedValue(1000),
                        setBalanceAndDecreaseScoins: jest.fn().mockResolvedValue({ red: 1000, scoins: 500 }),
                        updateUserStakeLevel: jest.fn().mockResolvedValue({}),
                    },
                })),
            },
            baseMetrics: {
                collectBetProcessedTime: jest.fn(),
            },
            provablyFairConsumer: {},
            gamePromotionApiClientFactory: {
                instance: jest.fn(() => ({
                    createPromotionTicket: mockCreatePromotionTicket,
                    rollbackBonusItem: mockRollbackBonusItem,
                    deductBonusItem: mockDeductBonusItem,
                })),
            },
        };

        // Store references to the mock functions for use in tests
        mockDependencies.mockCreatePromotionTicket = mockCreatePromotionTicket;
        mockDependencies.mockRollbackBonusItem = mockRollbackBonusItem;
        mockDependencies.mockDeductBonusItem = mockDeductBonusItem;

        processBetQueue = new ProcessBetQueue(mockDependencies);
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clear the specific promotion mocks
        if (mockDependencies?.mockCreatePromotionTicket) {
            mockDependencies.mockCreatePromotionTicket.mockClear();
        }
        if (mockDependencies?.mockRollbackBonusItem) {
            mockDependencies.mockRollbackBonusItem.mockClear();
        }
        if (mockDependencies?.mockDeductBonusItem) {
            mockDependencies.mockDeductBonusItem.mockClear();
        }
    });

    describe("Regular Bet Processing", () => {
        it("should successfully process a regular bet", async () => {
            // Arrange
            const player = createMockPlayer();
            const payload = createMockBetPayload();

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.placeBet).toHaveBeenCalledWith(
                { id: player.UID, session: player.session },
                expect.objectContaining({
                    amount: payload.amount,
                    gameId: mockDependencies.definition.id,
                    gameRoundId: payload.roundId,
                    choiceId: mockDependencies.definition.choicesMapper[payload.betChoice],
                })
            );
            expect(mockDependencies.betsRepository.updateOne).toHaveBeenCalled();
            expect(mockDependencies.placeBetPublisher.publishSuccessBet).toHaveBeenCalled();
        });

        it("should handle failed bet gracefully", async () => {
            // Arrange
            const player = createMockPlayer();
            const payload = createMockBetPayload();

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: false,
                    response: { apiError: "Insufficient balance" },
                });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    betChoice: payload.betChoice,
                    apiError: "Insufficient balance",
                })
            );
        });
    });

    describe("Promotion Bet Processing", () => {
        it("should successfully process a promotion bet and create promotion ticket", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Initialize player in gameData.ingame
            mockDependencies.gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                betTracks: {},
                ownBets: {},
            };

            when(mockDependencies.mockCreatePromotionTicket).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                ticketId: "ticket123",
            });

            // Mock promotion deduction
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.mockDeductBonusItem).toHaveBeenCalledWith({
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                playerId: player.session.playerId,
                promotionId: payload.promotionId,
                quantity: 1,
            });

            expect(player.promotion.bonusItemCount).toBe(49);

            expect(mockDependencies.placeBet).toHaveBeenCalledWith(
                { id: player.UID, session: player.session },
                expect.objectContaining({
                    amount: 0, // Promotion amount
                    metadata: expect.objectContaining({
                        usePromotion: true,
                        promotionId: payload.promotionId,
                    }),
                })
            );

            expect(mockDependencies.mockCreatePromotionTicket).toHaveBeenCalledWith(
                expect.objectContaining({
                    playerId: player.session.playerId,
                    operatorId: player.session.operatorId,
                    gameId: mockDependencies.definition.id,
                    gameRoundId: payload.roundId,
                    appType: 1,
                    betAmount: 0, // Promotion bet amount
                    winAmount: 0,
                })
            );
        });

        it("should handle promotion deduction failure gracefully", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Mock promotion deduction failure
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: false,
                error: "Deduction failed",
            });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.logService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Failed to deduct bonus item for player"),
                expect.objectContaining({
                    success: false,
                    error: "Deduction failed",
                })
            );

            expect(mockDependencies.placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: expect.objectContaining({
                        msg: "Promotion deduction failed",
                    }),
                })
            );

            // Bet API should not be called if deduction fails
            expect(mockDependencies.placeBet).not.toHaveBeenCalled();
        });

        it("should handle promotion deduction API timeout", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Mock promotion deduction timeout
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockRejectedValue(new Error("Request timeout"));

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.logService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error processing promotion deduction for player"),
                expect.any(Error)
            );

            expect(mockDependencies.placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: expect.objectContaining({
                        msg: "Promotion processing error",
                    }),
                })
            );

            // Bet API should not be called if deduction fails
            expect(mockDependencies.placeBet).not.toHaveBeenCalled();
        });

        it("should handle promotion ticket creation failure gracefully", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Initialize player in gameData.ingame
            mockDependencies.gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                betTracks: {},
                ownBets: {},
            };

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            mockDependencies.mockCreatePromotionTicket.mockResolvedValue({
                success: false,
                error: "Ticket creation failed",
            });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.logService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Failed to create promotion ticket for player"),
                expect.objectContaining({
                    error: "Ticket creation failed",
                    promotionId: payload.promotionId,
                })
            );

            // Bet should still be processed successfully
            expect(mockDependencies.placeBetPublisher.publishSuccessBet).toHaveBeenCalled();
        });

        it("should handle promotion ticket API timeout", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Initialize player in gameData.ingame
            mockDependencies.gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                betTracks: {},
                ownBets: {},
            };

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            mockDependencies.mockCreatePromotionTicket.mockRejectedValue(new Error("Request timeout"));

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.logService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error creating promotion ticket for player"),
                expect.objectContaining({
                    error: "Request timeout",
                    promotionId: payload.promotionId,
                })
            );
        });

        it("should rollback promotion when bet fails at API level", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: false,
                    response: { error: "Bet failed" },
                });

            when(mockDependencies.mockRollbackBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 50,
            });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.mockRollbackBonusItem).toHaveBeenCalledWith({
                operatorId: player.session.operatorId,
                siteName: player.session.siteName,
                playerId: player.session.playerId,
                promotionId: payload.promotionId,
                quantity: 1,
            });
        });

        it("should handle rollback API failure gracefully", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: false,
                    response: { error: "Bet failed" },
                });

            when(mockDependencies.mockRollbackBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: false,
                error: "Rollback failed",
            });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.logService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Failed to rollback promotion after API failure for player"),
                expect.objectContaining({
                    error: "Rollback failed",
                    promotionId: payload.promotionId,
                })
            );
        });
    });

    describe("Bet Data Storage", () => {
        it("should store promotion metadata in bet record", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Initialize player in gameData.ingame
            mockDependencies.gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                betTracks: {},
                ownBets: {},
            };

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.betsRepository.updateOne).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    $setOnInsert: expect.objectContaining({
                        usePromotion: true,
                        promotionId: payload.promotionId,
                    }),
                }),
                expect.any(Object)
            );
        });

        it("should store promotion metadata in bet log", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            // Initialize player in gameData.ingame
            mockDependencies.gameData.ingame[player.profile.name] = {
                name: player.profile.name,
                betTracks: {},
                ownBets: {},
            };

            // Mock promotion deduction success
            when(mockDependencies.mockDeductBonusItem).calledWith(expect.any(Object)).mockResolvedValue({
                success: true,
                remainingBonusItems: 49,
            });

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.betLogsRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    usePromotion: true,
                    promotionId: payload.promotionId,
                    choice: "red",
                    amount: 0,
                })
            );
        });
    });

    describe("Edge Cases and Error Handling", () => {
        it("should handle missing promotion API client gracefully", async () => {
            // Arrange
            const processBetQueueWithoutPromotion = new ProcessBetQueue({
                ...mockDependencies,
                gamePromotionApiClientFactory: null,
            });
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();

            when(mockDependencies.placeBet)
                .calledWith(expect.any(Object), expect.any(Object))
                .mockResolvedValue({
                    isOk: true,
                    response: { red: 1000, minBet: 100, maxBet: 5000 },
                });

            // Act
            await processBetQueueWithoutPromotion.proceedBet(player, payload);

            // Assert - Bet should be processed without promotion deduction
            expect(mockDependencies.placeBet).toHaveBeenCalled();
            expect(mockDependencies.placeBetPublisher.publishSuccessBet).toHaveBeenCalled();

            // No promotion deduction should occur
            expect(player.promotion.bonusItemCount).toBe(50); // Should remain unchanged
        });

        it("should handle validation failure for promotion bet", async () => {
            // Arrange
            const player = createMockPlayerWithPromotion();
            const payload = createMockPromotionBetPayload();
            payload.roundId = 999; // Invalid round ID

            // Act
            await processBetQueue.proceedBet(player, payload);

            // Assert
            expect(mockDependencies.placeBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                player.UID,
                expect.objectContaining({
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: expect.objectContaining({
                        errorCode: "PLACE_BET_NEXT_ROUND",
                    }),
                })
            );
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
                operatorId: "op123",
                siteName: "testSite",
                playerId: "player123",
                currencyName: "USD",
                currencyCode: "USD",
                multiplier: 1,
                siteId: "site123",
            },
        };
    }

    function createMockPlayerWithPromotion() {
        const player = createMockPlayer();
        player.promotion = {
            promotionId: "promo123",
            code: "FREESPIN50",
            bonusItemCount: 50,
            isActive: true,
            promotionType: "FREE_SPIN",
        };
        return player;
    }

    function createMockBetPayload() {
        return {
            betChoice: "red",
            amount: 500,
            freeBet: false,
            usePromotion: false,
            roundId: 456,
            mode: "1",
            clientSeed: "test-seed",
            receivedTime: new Date(),
        };
    }

    function createMockPromotionBetPayload() {
        return {
            betChoice: "red",
            amount: 0,
            freeBet: false,
            usePromotion: true,
            promotionId: "promo123",
            roundId: 456,
            mode: "1",
            clientSeed: "test-seed",
            receivedTime: new Date(),
        };
    }
});
