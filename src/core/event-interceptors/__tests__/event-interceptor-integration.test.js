import Chance from "chance";
import ProcessBetQueue from "../../crons/process-bet-queue.js";
import PromotionBetInterceptor from "../promotion-bet-interceptor.js";

describe("Event Interceptor Integration", () => {
    const chance = new Chance();
    let processBetQueue;
    let mockDependencies;
    let promotionInterceptor;
    let player;
    let promotionPayload;

    beforeEach(() => {
        // Arrange - Create mock dependencies following game base patterns
        mockDependencies = {
            definition: {
                id: chance.natural(),
                durations: {
                    lockingBet: 5,
                    placingBets: 50,
                },
                choicesMapper: {
                    red: 1,
                    black: 2,
                },
            },
            gameData: {
                roundId: chance.natural(),
                remainingTime: 30,
                ingame: {},
                exchangeRates: {
                    code: { USD: 1 },
                },
                currencies: [],
                gameConfigs: { odds: 2 },
            },
            placeBetPublisher: {
                publishGameFailedBet: jest.fn(),
                publishSuccessBet: jest.fn(),
                publishToUser: jest.fn(),
            },
            placeBet: jest.fn(),
            logService: {
                logInfo: jest.fn(),
                logError: jest.fn(),
                logWarning: jest.fn(),
            },
            betsRepository: {
                updateOne: jest.fn(),
            },
            betLogsRepository: {
                create: jest.fn(),
            },
            gameManagementApiClientFactory: {
                instance: () => ({
                    users: {
                        setBalanceAndDecreaseScoins: jest.fn().mockResolvedValue({}),
                        updateUserStakeLevel: jest.fn().mockResolvedValue({}),
                    },
                }),
            },
            baseMetrics: {
                collectBetProcessedTime: jest.fn(),
            },
            gamePromotionApiClient: {
                deductBonusItem: jest.fn(),
                createPromotionTicket: jest.fn(),
                rollbackBonusItem: jest.fn(),
            },
        };

        // Create test player
        player = {
            UID: chance.string(),
            profile: {
                name: chance.name(),
                minBet: 1,
                maxBet: 10000,
            },
            session: {
                operatorId: chance.string(),
                siteName: chance.string(),
                playerId: chance.string(),
                multiplier: 1,
                currencyCode: "USD",
            },
            promotion: {
                promotionId: chance.string(),
                bonusItemCount: 5,
            },
        };

        // Create promotion bet payload
        promotionPayload = {
            betChoice: "red",
            amount: 0,
            usePromotion: true,
            promotionId: player.promotion.promotionId,
            roundId: mockDependencies.gameData.roundId,
            receivedTime: new Date(),
            mode: "1",
        };

        // Add player to gameData.ingame for end-to-end tests
        mockDependencies.gameData.ingame = {
            [player.profile.name]: {
                name: player.profile.name,
                ownBets: {},
                betTracks: {},
                betQueue: [],
            },
        };

        // Create promotion interceptor
        promotionInterceptor = new PromotionBetInterceptor({
            logService: mockDependencies.logService,
            definition: mockDependencies.definition,
            placeBetPublisher: mockDependencies.placeBetPublisher,
            gamePromotionApiClient: mockDependencies.gamePromotionApiClient,
        });

        // Create ProcessBetQueue with interceptors
        processBetQueue = new ProcessBetQueue({
            ...mockDependencies,
            betEventInterceptors: [promotionInterceptor],
        });
    });

    describe("Event Interceptor System Initialization", () => {
        it("should initialize ProcessBetQueue with event interceptors", () => {
            // Assert
            expect(processBetQueue.eventInterceptors).toHaveLength(1);
            expect(processBetQueue.eventInterceptors[0]).toBe(promotionInterceptor);
            expect(processBetQueue.eventType).toBe("bet");
        });

        it("should handle empty interceptors array gracefully", () => {
            // Arrange
            const queueWithoutInterceptors = new ProcessBetQueue({
                ...mockDependencies,
                betEventInterceptors: [],
            });

            // Assert
            expect(queueWithoutInterceptors.eventInterceptors).toHaveLength(0);
            expect(queueWithoutInterceptors.eventType).toBe("bet");
        });

        it("should handle undefined interceptors gracefully", () => {
            // Arrange
            const queueWithUndefinedInterceptors = new ProcessBetQueue({
                ...mockDependencies,
                betEventInterceptors: undefined,
            });

            // Assert
            expect(queueWithUndefinedInterceptors.eventInterceptors).toHaveLength(0);
            expect(queueWithUndefinedInterceptors.eventType).toBe("bet");
        });
    });

    describe("Event Interceptor Filtering", () => {
        it("should correctly identify applicable interceptors for promotion bets", () => {
            // Act
            const applicableInterceptors = processBetQueue.getApplicableInterceptors({ payload: promotionPayload });

            // Assert
            expect(applicableInterceptors).toHaveLength(1);
            expect(applicableInterceptors[0]).toBe(promotionInterceptor);
        });

        it("should return no interceptors for regular bets", () => {
            // Arrange
            const regularPayload = {
                betChoice: "black",
                amount: 100,
                usePromotion: false,
            };

            // Act
            const applicableInterceptors = processBetQueue.getApplicableInterceptors({ payload: regularPayload });

            // Assert
            expect(applicableInterceptors).toHaveLength(0);
        });

        it("should return no interceptors when promotion API is not available", () => {
            // Arrange
            const interceptorWithoutAPI = new PromotionBetInterceptor({
                logService: mockDependencies.logService,
                definition: mockDependencies.definition,
                placeBetPublisher: mockDependencies.placeBetPublisher,
                gamePromotionApiClient: null, // No API available
            });

            const queueWithoutAPI = new ProcessBetQueue({
                ...mockDependencies,
                betEventInterceptors: [interceptorWithoutAPI],
            });

            // Act
            const applicableInterceptors = queueWithoutAPI.getApplicableInterceptors({ payload: promotionPayload });

            // Assert
            expect(applicableInterceptors).toHaveLength(0);
        });
    });

    describe("Event Interceptor Event Execution", () => {
        it("should execute beforeEvent for promotion bets", async () => {
            // Arrange
            const context = { player, payload: promotionPayload };
            mockDependencies.gamePromotionApiClient.deductBonusItem.mockResolvedValue({
                success: true,
                remainingBonusItems: 4,
            });

            // Act
            const result = await processBetQueue.executeInterceptorEvent("beforeEvent", [promotionInterceptor], context);

            // Assert
            expect(result.success).toBe(true);
            expect(mockDependencies.gamePromotionApiClient.deductBonusItem).toHaveBeenCalled();
        });

        it("should handle interceptor event failures gracefully", async () => {
            // Arrange
            const context = { player, payload: promotionPayload };
            mockDependencies.gamePromotionApiClient.deductBonusItem.mockResolvedValue({
                success: false,
                error: "API Error",
            });

            // Act
            const result = await processBetQueue.executeInterceptorEvent("beforeEvent", [promotionInterceptor], context);

            // Assert
            expect(result.success).toBe(false);
            expect(mockDependencies.logService.logWarning).toHaveBeenCalled();
        });

        it("should handle empty interceptor arrays gracefully", async () => {
            // Arrange
            const context = { player, payload: promotionPayload };

            // Act
            const result = await processBetQueue.executeInterceptorEvent("beforeEvent", [], context);

            // Assert
            expect(result.success).toBe(true);
        });

        it("should handle undefined interceptor arrays gracefully", async () => {
            // Arrange
            const context = { player, payload: promotionPayload };

            // Act
            const result = await processBetQueue.executeInterceptorEvent("beforeEvent", undefined, context);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe("Event Interceptor Transform Execution", () => {
        it("should transform bet info with promotion metadata", () => {
            // Arrange
            const betInfo = {
                amount: 0,
                gameId: mockDependencies.definition.id,
                metadata: { mode: "1" },
            };
            const context = { betInfo, payload: promotionPayload };

            // Act
            const enhancedBetInfo = processBetQueue.executeInterceptorTransform("enhanceBetInfo", [promotionInterceptor], context);

            // Assert
            expect(enhancedBetInfo.metadata.usePromotion).toBe(true);
            expect(enhancedBetInfo.metadata.promotionId).toBe(promotionPayload.promotionId);
        });

        it("should handle empty interceptor arrays in transforms", () => {
            // Arrange
            const betInfo = {
                amount: 100,
                gameId: mockDependencies.definition.id,
            };
            const context = { betInfo, payload: { betChoice: "black" } };

            // Act
            const result = processBetQueue.executeInterceptorTransform("enhanceBetInfo", [], context);

            // Assert
            expect(result).toBe(betInfo);
        });

        it("should handle undefined interceptor arrays in transforms", () => {
            // Arrange
            const betInfo = {
                amount: 100,
                gameId: mockDependencies.definition.id,
            };
            const context = { betInfo, payload: { betChoice: "black" } };

            // Act
            const result = processBetQueue.executeInterceptorTransform("enhanceBetInfo", undefined, context);

            // Assert
            expect(result).toBe(betInfo);
        });
    });

    describe("End-to-End Event Interceptor Integration", () => {
        it("should process promotion bet through complete interceptor flow", async () => {
            // Arrange
            mockDependencies.gamePromotionApiClient.deductBonusItem.mockResolvedValue({
                success: true,
                remainingBonusItems: 4,
            });
            mockDependencies.gamePromotionApiClient.createPromotionTicket.mockResolvedValue({
                success: true,
                ticketId: "ticket123",
            });
            mockDependencies.placeBet.mockResolvedValue({
                isOk: true,
                response: {
                    red: 1000,
                    minBet: 1,
                    maxBet: 10000,
                },
            });

            // Act
            await processBetQueue.proceedBet(player, promotionPayload);

            // Assert
            expect(mockDependencies.gamePromotionApiClient.deductBonusItem).toHaveBeenCalled();
            expect(mockDependencies.placeBet).toHaveBeenCalled();
            expect(mockDependencies.gamePromotionApiClient.createPromotionTicket).toHaveBeenCalled();
        });
    });
});
