import Chance from "chance";
import { helpers } from "sc-common";
import { stub } from "jest-micro-auto-stub";
import PromotionConsumer from "../promotion-consumer";

describe("PromotionConsumer", () => {
    const chance = new Chance();
    let promotionConsumer;
    let mockLogService;
    let mockGamePromotionApiClient;
    let mockGamePromotionApiClientFactory;
    let mockPlaceBetPublisher;
    let mockDefinition;
    let player;
    let payload;

    const createFreshPlayer = () => ({
        UID: chance.string(),
        profile: { name: chance.string() },
        session: {
            operatorId: chance.string(),
            siteName: chance.string(),
            playerId: chance.string(),
        },
        promotion: {
            promotionId: chance.string(),
            bonusItemCount: chance.natural({ min: 1, max: 10 }),
        },
    });

    beforeEach(() => {
        // Arrange - Setup mocks
        mockLogService = {
            logError: jest.fn(),
            logInfo: jest.fn(),
            logWarning: jest.fn(),
        };

        mockGamePromotionApiClient = {
            deductBonusItem: jest.fn(),
            createPromotionTicket: jest.fn(),
            rollbackBonusItem: jest.fn(),
        };

        mockGamePromotionApiClientFactory = {
            instance: jest.fn().mockReturnValue(mockGamePromotionApiClient),
        };

        mockPlaceBetPublisher = {
            publishGameFailedBet: jest.fn(),
        };

        mockDefinition = {
            id: chance.natural(),
            name: chance.string(),
        };

        // Create a fresh player object for each test to avoid state pollution
        player = createFreshPlayer();

        payload = {
            betChoice: chance.pickone(["red", "black", "odd", "even"]),
            amount: chance.natural({ min: 100, max: 1000 }),
            usePromotion: true,
            promotionId: player.promotion.promotionId,
        };

        promotionConsumer = new PromotionConsumer({
            logService: mockLogService,
            gamePromotionApiClientFactory: mockGamePromotionApiClientFactory,
            placeBetPublisher: mockPlaceBetPublisher,
            definition: mockDefinition,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("constructor", () => {
        it("should initialize with provided dependencies", () => {
            // Assert
            expect(promotionConsumer.logService).toBe(mockLogService);
            expect(promotionConsumer.gamePromotionApiClient).toBe(mockGamePromotionApiClient);
            expect(promotionConsumer.placeBetPublisher).toBe(mockPlaceBetPublisher);
            expect(promotionConsumer.definition).toBe(mockDefinition);
        });

        it("should handle null gamePromotionApiClientFactory gracefully", () => {
            // Arrange & Act
            const consumer = new PromotionConsumer({
                logService: mockLogService,
                gamePromotionApiClientFactory: null,
                placeBetPublisher: mockPlaceBetPublisher,
                definition: mockDefinition,
            });

            // Assert
            expect(consumer.gamePromotionApiClient).toBeUndefined();
        });
    });

    describe("processPromotionDeduction", () => {
        describe("when API client is not available", () => {
            beforeEach(() => {
                promotionConsumer.gamePromotionApiClient = null;
            });

            it("should log error and publish failed bet", async () => {
                // Act
                const result = await promotionConsumer.processPromotionDeduction(player, payload);

                // Assert
                expect(result.success).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(expect.stringContaining("Promotion API client not available"));
                expect(mockPlaceBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                    player.UID,
                    expect.objectContaining({
                        endBet: -1,
                        betChoice: payload.betChoice,
                        notice: expect.objectContaining({
                            errorCode: helpers.noticeHelper.invalidBet,
                            msg: "Promotion service unavailable",
                        }),
                    })
                );
            });
        });

        describe("when API client is available", () => {
            it("should successfully deduct bonus item", async () => {
                // Arrange
                const deductResult = {
                    success: true,
                    remainingBonusItems: player.promotion.bonusItemCount - 1,
                };
                mockGamePromotionApiClient.deductBonusItem.mockResolvedValue(deductResult);

                // Act
                const result = await promotionConsumer.processPromotionDeduction(player, payload);

                // Assert
                expect(result.success).toBe(true);
                expect(mockGamePromotionApiClient.deductBonusItem).toHaveBeenCalledWith({
                    operatorId: player.session.operatorId,
                    siteName: player.session.siteName,
                    playerId: player.session.playerId,
                    promotionId: player.promotion.promotionId,
                    quantity: 1,
                });
                expect(player.promotion.bonusItemCount).toBe(deductResult.remainingBonusItems);
                expect(mockLogService.logInfo).toHaveBeenCalledWith(
                    expect.stringContaining("Successfully deducted bonus item"),
                    expect.objectContaining({
                        promotionId: player.promotion.promotionId,
                        remainingBonusItems: deductResult.remainingBonusItems,
                    })
                );
            });

            it("should handle API deduction failure", async () => {
                // Arrange
                const deductResult = { success: false, error: "Insufficient bonus items" };
                mockGamePromotionApiClient.deductBonusItem.mockResolvedValue(deductResult);

                // Act
                const result = await promotionConsumer.processPromotionDeduction(player, payload);

                // Assert
                expect(result.success).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(expect.stringContaining("Failed to deduct bonus item"), deductResult);
                expect(mockPlaceBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                    player.UID,
                    expect.objectContaining({
                        notice: expect.objectContaining({
                            msg: "Promotion deduction failed",
                        }),
                    })
                );
            });

            it("should handle API exception", async () => {
                // Arrange
                const apiError = new Error("Network timeout");
                mockGamePromotionApiClient.deductBonusItem.mockRejectedValue(apiError);

                // Act
                const result = await promotionConsumer.processPromotionDeduction(player, payload);

                // Assert
                expect(result.success).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    expect.stringContaining("Error processing promotion deduction"),
                    apiError
                );
                expect(mockPlaceBetPublisher.publishGameFailedBet).toHaveBeenCalledWith(
                    player.UID,
                    expect.objectContaining({
                        notice: expect.objectContaining({
                            msg: "Promotion processing error",
                        }),
                    })
                );
            });
        });
    });

    describe("createPromotionTicket", () => {
        const bet = {
            roundId: chance.natural(),
            amount: chance.natural(),
            promotionId: chance.string(),
        };
        const betTime = new Date();

        describe("when API client is not available", () => {
            beforeEach(() => {
                promotionConsumer.gamePromotionApiClient = null;
            });

            it("should log info and return false", async () => {
                // Act
                const result = await promotionConsumer.createPromotionTicket(player, bet, betTime);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logInfo).toHaveBeenCalledWith(
                    expect.stringContaining("Promotion API client not available for ticket creation")
                );
            });
        });

        describe("when API client is available", () => {
            it("should successfully create promotion ticket", async () => {
                // Arrange
                const ticketResult = {
                    success: true,
                    ticketId: chance.string(),
                };
                mockGamePromotionApiClient.createPromotionTicket.mockResolvedValue(ticketResult);

                // Act
                const result = await promotionConsumer.createPromotionTicket(player, bet, betTime);

                // Assert
                expect(result).toBe(true);
                expect(mockGamePromotionApiClient.createPromotionTicket).toHaveBeenCalledWith({
                    playerId: player.session.playerId,
                    operatorId: player.session.operatorId,
                    gameId: mockDefinition.id,
                    gameRoundId: bet.roundId,
                    appType: 1,
                    betAmount: bet.amount,
                    winAmount: 0,
                });
                expect(mockLogService.logInfo).toHaveBeenCalledWith(
                    expect.stringContaining("Successfully created promotion ticket"),
                    expect.objectContaining({
                        promotionId: bet.promotionId,
                        gameRoundId: bet.roundId,
                        ticketId: ticketResult.ticketId,
                    })
                );
            });

            it("should handle ticket creation failure", async () => {
                // Arrange
                const ticketResult = { success: false, error: "Ticket creation failed" };
                mockGamePromotionApiClient.createPromotionTicket.mockResolvedValue(ticketResult);

                // Act
                const result = await promotionConsumer.createPromotionTicket(player, bet, betTime);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    expect.stringContaining("Failed to create promotion ticket"),
                    expect.objectContaining({
                        error: "Ticket creation failed",
                        promotionId: bet.promotionId,
                        gameRoundId: bet.roundId,
                    })
                );
            });

            it("should handle API exception", async () => {
                // Arrange
                const apiError = new Error("API timeout");
                mockGamePromotionApiClient.createPromotionTicket.mockRejectedValue(apiError);

                // Act
                const result = await promotionConsumer.createPromotionTicket(player, bet, betTime);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    expect.stringContaining("Error creating promotion ticket"),
                    expect.objectContaining({
                        error: apiError.message,
                        promotionId: bet.promotionId,
                        stack: apiError.stack,
                    })
                );
            });
        });
    });

    describe("rollbackPromotionOnFailure", () => {
        let bet;

        beforeEach(() => {
            bet = {
                promotionId: player.promotion.promotionId,
            };
        });

        describe("when API client is not available", () => {
            beforeEach(() => {
                promotionConsumer.gamePromotionApiClient = null;
            });

            it("should log warning and return false", async () => {
                // Act
                const result = await promotionConsumer.rollbackPromotionOnFailure(player, bet);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logWarning).toHaveBeenCalledWith(
                    expect.stringContaining("Promotion API client not available for rollback")
                );
            });
        });

        describe("when API client is available", () => {
            it("should successfully rollback bonus item", async () => {
                // Arrange
                const originalBonusCount = player.promotion.bonusItemCount;
                const rollbackResult = {
                    success: true,
                    remainingBonusItems: originalBonusCount + 1,
                };
                mockGamePromotionApiClient.rollbackBonusItem.mockResolvedValue(rollbackResult);

                // Act
                const result = await promotionConsumer.rollbackPromotionOnFailure(player, bet);

                // Assert
                expect(result).toBe(true);
                expect(mockGamePromotionApiClient.rollbackBonusItem).toHaveBeenCalledWith({
                    operatorId: player.session.operatorId,
                    siteName: player.session.siteName,
                    playerId: player.session.playerId,
                    promotionId: bet.promotionId,
                    quantity: 1,
                });
                expect(player.promotion.bonusItemCount).toBe(rollbackResult.remainingBonusItems);
                expect(mockLogService.logInfo).toHaveBeenCalledWith(
                    expect.stringContaining("Successfully rolled back promotion"),
                    expect.objectContaining({
                        promotionId: bet.promotionId,
                        remainingBonusItems: rollbackResult.remainingBonusItems,
                    })
                );
            });

            it("should handle rollback failure", async () => {
                // Arrange
                const rollbackResult = { success: false, error: "Rollback failed" };
                mockGamePromotionApiClient.rollbackBonusItem.mockResolvedValue(rollbackResult);

                // Act
                const result = await promotionConsumer.rollbackPromotionOnFailure(player, bet);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    expect.stringContaining("Failed to rollback promotion"),
                    expect.objectContaining({
                        error: "Rollback failed",
                        promotionId: bet.promotionId,
                    })
                );
            });

            it("should handle API exception", async () => {
                // Arrange
                const apiError = new Error("Connection failed");
                mockGamePromotionApiClient.rollbackBonusItem.mockRejectedValue(apiError);

                // Act
                const result = await promotionConsumer.rollbackPromotionOnFailure(player, bet);

                // Assert
                expect(result).toBe(false);
                expect(mockLogService.logError).toHaveBeenCalledWith(
                    expect.stringContaining("Error rolling back promotion"),
                    expect.objectContaining({
                        error: apiError.message,
                        promotionId: bet.promotionId,
                        stack: apiError.stack,
                    })
                );
            });
        });
    });

    describe("addPromotionMetadata", () => {
        it("should add promotion metadata when usePromotion is true", () => {
            // Arrange
            const betInfo = { metadata: { mode: "1" } };
            const promotionPayload = {
                usePromotion: true,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.addPromotionMetadata(betInfo, promotionPayload);

            // Assert
            expect(result.metadata.usePromotion).toBe(true);
            expect(result.metadata.promotionId).toBe(promotionPayload.promotionId);
            expect(result.metadata.mode).toBe("1"); // Existing metadata preserved
        });

        it("should not add promotion metadata when usePromotion is false", () => {
            // Arrange
            const betInfo = { metadata: { mode: "1" } };
            const regularPayload = {
                usePromotion: false,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.addPromotionMetadata(betInfo, regularPayload);

            // Assert
            expect(result.metadata.usePromotion).toBeUndefined();
            expect(result.metadata.promotionId).toBeUndefined();
            expect(result.metadata.mode).toBe("1"); // Existing metadata preserved
        });

        it("should create metadata object if it doesn't exist", () => {
            // Arrange
            const betInfo = {};
            const promotionPayload = {
                usePromotion: true,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.addPromotionMetadata(betInfo, promotionPayload);

            // Assert
            expect(result.metadata).toBeDefined();
            expect(result.metadata.usePromotion).toBe(true);
            expect(result.metadata.promotionId).toBe(promotionPayload.promotionId);
        });
    });

    describe("addPromotionMetadataToBet", () => {
        it("should add promotion metadata to bet record", () => {
            // Arrange
            const betRecord = { uid: chance.string(), amount: chance.natural() };
            const bet = {
                usePromotion: true,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.addPromotionMetadataToBet(betRecord, bet);

            // Assert
            expect(result.usePromotion).toBe(true);
            expect(result.promotionId).toBe(bet.promotionId);
            expect(result.uid).toBe(betRecord.uid); // Existing data preserved
        });

        it("should not add metadata when usePromotion is false", () => {
            // Arrange
            const betRecord = { uid: chance.string() };
            const bet = { usePromotion: false };

            // Act
            const result = promotionConsumer.addPromotionMetadataToBet(betRecord, bet);

            // Assert
            expect(result.usePromotion).toBeUndefined();
            expect(result.promotionId).toBeUndefined();
        });
    });

    describe("addPromotionMetadataToBetLog", () => {
        it("should add promotion metadata to bet log", () => {
            // Arrange
            const betLog = { uid: chance.string(), time: new Date() };
            const bet = {
                usePromotion: true,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.addPromotionMetadataToBetLog(betLog, bet);

            // Assert
            expect(result.usePromotion).toBe(true);
            expect(result.promotionId).toBe(bet.promotionId);
            expect(result.uid).toBe(betLog.uid); // Existing data preserved
        });

        it("should not add metadata when usePromotion is false", () => {
            // Arrange
            const betLog = { uid: chance.string() };
            const bet = { usePromotion: false };

            // Act
            const result = promotionConsumer.addPromotionMetadataToBetLog(betLog, bet);

            // Assert
            expect(result.usePromotion).toBeUndefined();
            expect(result.promotionId).toBeUndefined();
        });
    });

    describe("isPromotionBet", () => {
        it("should return true for promotion bets", () => {
            // Arrange
            const promotionPayload = {
                usePromotion: true,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.isPromotionBet(promotionPayload);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when usePromotion is false", () => {
            // Arrange
            const regularPayload = {
                usePromotion: false,
                promotionId: chance.string(),
            };

            // Act
            const result = promotionConsumer.isPromotionBet(regularPayload);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when promotionId is missing", () => {
            // Arrange
            const invalidPayload = {
                usePromotion: true,
                promotionId: null,
            };

            // Act
            const result = promotionConsumer.isPromotionBet(invalidPayload);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("isPromotionApiAvailable", () => {
        it("should return true when API client is available", () => {
            // Act
            const result = promotionConsumer.isPromotionApiAvailable();

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when API client is not available", () => {
            // Arrange
            promotionConsumer.gamePromotionApiClient = null;

            // Act
            const result = promotionConsumer.isPromotionApiAvailable();

            // Assert
            expect(result).toBe(false);
        });
    });
});
