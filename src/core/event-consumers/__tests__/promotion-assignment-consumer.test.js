import { stub } from "jest-micro-auto-stub";
import Chance from "chance";
import PromotionAssignmentConsumer from "../promotion-assignment-consumer";

const chance = new Chance();

describe("PromotionAssignmentConsumer", () => {
    let consumer;
    let mockGamePromotionApiClient;
    let mockLogService;
    let mockPublisher;
    let mockDefinition;
    let mockPlayer;

    beforeEach(() => {
        // Mock dependencies
        mockGamePromotionApiClient = {
            instance: jest.fn().mockReturnThis(),
            checkEligibility: jest.fn(),
        };

        mockLogService = {
            logInfo: jest.fn(),
            logError: jest.fn(),
        };

        mockPublisher = {
            publishToUser: jest.fn(),
        };

        mockDefinition = {
            id: "test-game-123",
            name: "Test Game",
        };

        // Mock player object
        mockPlayer = {
            UID: chance.guid(),
            session: {
                playerId: chance.guid(),
                currencyGroupId: "USD",
                operatorId: "OP-123",
                siteName: "TestSite",
            },
            promotion: null,
            promotionTOProgress: null,
        };

        // Create consumer instance
        consumer = new PromotionAssignmentConsumer({
            definition: mockDefinition,
            gamePromotionApiClient: mockGamePromotionApiClient,
            logService: mockLogService,
            publisher: mockPublisher,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("clearPromotionData", () => {
        it("should clear both promotion and promotionTOProgress from player", () => {
            mockPlayer.promotion = { promotionId: "PROMO-123" };
            mockPlayer.promotionTOProgress = { totalTO: 1000 };

            consumer.clearPromotionData(mockPlayer);

            expect(mockPlayer.promotion).toBeUndefined();
            expect(mockPlayer.promotionTOProgress).toBeUndefined();
        });

        it("should not throw error if promotion data does not exist", () => {
            expect(() => consumer.clearPromotionData(mockPlayer)).not.toThrow();
        });
    });

    describe("fetchNextAvailablePromotion", () => {
        it("should fetch and format promotion data when promotion available", async () => {
            const mockPromotion = {
                _id: "PROMO-456",
                bonusItemCount: 10,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
            };

            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: [mockPromotion],
            });

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(mockGamePromotionApiClient.checkEligibility).toHaveBeenCalledWith({
                playerId: mockPlayer.session.playerId,
                currencyGroup: mockPlayer.session.currencyGroupId,
                operatorId: mockPlayer.session.operatorId,
                siteName: mockPlayer.session.siteName,
                gameId: mockDefinition.id,
            });

            expect(result).toEqual({
                promotionId: mockPromotion._id,
                remainingBonusItems: mockPromotion.bonusItemCount,
                isActive: expect.any(Boolean),
                endDate: mockPromotion.endDate,
                isGiftCode: mockPromotion.isGiftCode,
                isClaimed: false,
            });
        });

        it("should return null when no promotions available", async () => {
            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: [],
            });

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result).toBeNull();
        });

        it("should return null when API returns null", async () => {
            mockGamePromotionApiClient.checkEligibility.mockResolvedValue(null);

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result).toBeNull();
            // No error logged - null is a valid response
        });

        it("should return null when API returns undefined", async () => {
            mockGamePromotionApiClient.checkEligibility.mockResolvedValue(undefined);

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result).toBeNull();
            // No error logged - undefined is handled gracefully
        });

        it("should handle API error and return null", async () => {
            mockGamePromotionApiClient.checkEligibility.mockRejectedValue(new Error("API Error"));

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result).toBeNull();
            expect(mockLogService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error fetching next available promotion")
            );
        });

        it("should calculate isActive correctly for promotion with endDate", async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: [
                    {
                        _id: "PROMO-789",
                        bonusItemCount: 5,
                        endDate: futureDate.toISOString(),
                        isGiftCode: true,
                    },
                ],
            });

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result.isActive).toBe(true);
        });

        it("should set isActive to false for promotion without endDate", async () => {
            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: [
                    {
                        _id: "PROMO-999",
                        bonusItemCount: 15,
                        endDate: null,
                        isGiftCode: false,
                    },
                ],
            });

            const result = await consumer.fetchNextAvailablePromotion(mockPlayer);

            expect(result.isActive).toBe(false);
        });
    });

    describe("assignNextPromotion", () => {
        it("should assign promotion to player and publish when promotion available", async () => {
            const mockPromotionData = {
                promotionId: "PROMO-111",
                remainingBonusItems: 20,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);

            const result = await consumer.assignNextPromotion(mockPlayer, { publishToClient: true });

            expect(mockPlayer.promotion).toEqual(mockPromotionData);
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(mockPlayer.UID, {
                promotion: mockPromotionData,
            });
            expect(result).toEqual(mockPromotionData);
            expect(mockLogService.logInfo).toHaveBeenCalledWith(
                expect.stringContaining("Assigned promotion PROMO-111")
            );
        });

        it("should set player.promotion to null when no promotion available", async () => {
            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(null);

            const result = await consumer.assignNextPromotion(mockPlayer);

            expect(mockPlayer.promotion).toBeNull();
            expect(mockPublisher.publishToUser).not.toHaveBeenCalled();
            expect(result).toBeNull();
            expect(mockLogService.logInfo).toHaveBeenCalledWith(
                expect.stringContaining("No promotion available")
            );
        });

        it("should not publish when publishToClient is false", async () => {
            const mockPromotionData = {
                promotionId: "PROMO-222",
                remainingBonusItems: 5,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);

            await consumer.assignNextPromotion(mockPlayer, { publishToClient: false });

            expect(mockPlayer.promotion).toEqual(mockPromotionData);
            expect(mockPublisher.publishToUser).not.toHaveBeenCalled();
        });

        it("should clear existing promotion data when clearExisting is true", async () => {
            mockPlayer.promotion = { promotionId: "OLD-PROMO" };
            mockPlayer.promotionTOProgress = { totalTO: 500 };

            const mockPromotionData = {
                promotionId: "PROMO-333",
                remainingBonusItems: 10,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);
            const clearSpy = jest.spyOn(consumer, "clearPromotionData");

            await consumer.assignNextPromotion(mockPlayer, { clearExisting: true });

            expect(clearSpy).toHaveBeenCalledWith(mockPlayer);
            expect(mockPlayer.promotion).toEqual(mockPromotionData);
        });

        it("should handle errors gracefully and set promotion to null", async () => {
            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockRejectedValue(new Error("Fetch Error"));

            const result = await consumer.assignNextPromotion(mockPlayer);

            expect(mockPlayer.promotion).toBeNull();
            expect(result).toBeNull();
            expect(mockLogService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error assigning promotion")
            );
        });
    });

    describe("assignNextPromotionWithPublisher", () => {
        it("should use custom publisher when provided", async () => {
            const customPublisher = jest.fn();
            const mockPromotionData = {
                promotionId: "PROMO-444",
                remainingBonusItems: 8,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);

            await consumer.assignNextPromotionWithPublisher(mockPlayer, customPublisher);

            expect(customPublisher).toHaveBeenCalledWith(mockPlayer.UID, { promotion: mockPromotionData });
            expect(mockPublisher.publishToUser).not.toHaveBeenCalled();
        });

        it("should not call publisher when promotion is null", async () => {
            const customPublisher = jest.fn();

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(null);

            await consumer.assignNextPromotionWithPublisher(mockPlayer, customPublisher);

            expect(customPublisher).not.toHaveBeenCalled();
            expect(mockPlayer.promotion).toBeNull();
        });

        it("should work without custom publisher", async () => {
            const mockPromotionData = {
                promotionId: "PROMO-555",
                remainingBonusItems: 12,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);

            await consumer.assignNextPromotionWithPublisher(mockPlayer, null);

            expect(mockPlayer.promotion).toEqual(mockPromotionData);
        });

        it("should clear existing data when clearExisting option is true", async () => {
            mockPlayer.promotion = { promotionId: "OLD-PROMO" };
            mockPlayer.promotionTOProgress = { totalTO: 750 };

            const customPublisher = jest.fn();
            const mockPromotionData = {
                promotionId: "PROMO-666",
                remainingBonusItems: 15,
                isActive: true,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: false,
                isClaimed: false,
            };

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockResolvedValue(mockPromotionData);
            const clearSpy = jest.spyOn(consumer, "clearPromotionData");

            await consumer.assignNextPromotionWithPublisher(mockPlayer, customPublisher, {
                clearExisting: true,
            });

            expect(clearSpy).toHaveBeenCalledWith(mockPlayer);
            expect(mockPlayer.promotion).toEqual(mockPromotionData);
        });

        it("should handle errors and log appropriately", async () => {
            const customPublisher = jest.fn();

            jest.spyOn(consumer, "fetchNextAvailablePromotion").mockRejectedValue(new Error("Fetch Error"));

            await consumer.assignNextPromotionWithPublisher(mockPlayer, customPublisher);

            expect(mockPlayer.promotion).toBeNull();
            expect(mockLogService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error assigning promotion")
            );
            expect(customPublisher).not.toHaveBeenCalled();
        });
    });

    describe("Integration Scenarios", () => {
        it("should handle complete flow: clear old promotion, fetch new, assign, and publish", async () => {
            // Setup: Player has old promotion
            mockPlayer.promotion = { promotionId: "OLD-123" };
            mockPlayer.promotionTOProgress = { totalTO: 1000, canClaim: true };

            const newPromotionData = {
                _id: "NEW-456",
                bonusItemCount: 25,
                endDate: "2025-12-31T23:59:59Z",
                isGiftCode: true,
            };

            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: [newPromotionData],
            });

            // Execute
            const result = await consumer.assignNextPromotion(mockPlayer, {
                clearExisting: true,
                publishToClient: true,
            });

            // Verify: Old data cleared, new promotion assigned, published
            expect(result).toEqual({
                promotionId: newPromotionData._id,
                remainingBonusItems: newPromotionData.bonusItemCount,
                isActive: expect.any(Boolean),
                endDate: newPromotionData.endDate,
                isGiftCode: newPromotionData.isGiftCode,
                isClaimed: false,
            });

            expect(mockPlayer.promotion).toEqual(result);
            expect(mockPublisher.publishToUser).toHaveBeenCalledWith(mockPlayer.UID, {
                promotion: result,
            });
        });

        it("should handle scenario when API returns promotions but all are invalid", async () => {
            mockGamePromotionApiClient.checkEligibility.mockResolvedValue({
                promotions: null, // Invalid response
            });

            const result = await consumer.assignNextPromotion(mockPlayer);

            expect(result).toBeNull();
            expect(mockPlayer.promotion).toBeNull();
        });
    });
});
