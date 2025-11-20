import GameDefinition from "../../game-definition";
import BonusWinConsumer from "../bonus-win-consumer";

describe("BonusWinConsumer", () => {
    let bonusWinConsumer;
    let mockLogService;
    let mockPublisher;
    let player;
    let apiClient;
    let mockAward;
    let definition;

    const createPlayer = () => ({
        UID: "test-uid",
        promotion: { promotionId: "promo-id" },
        session: {
            playerId: "player-id",
            operatorId: "operator-id",
            siteName: "site-name",
            siteId: "site-id",
            currencyName: "USD",
            currencyGroupId: "currency-group-id",
        },
    });

    beforeEach(() => {
        mockLogService = { logError: jest.fn() };
        mockPublisher = { publishToUser: jest.fn() };
        apiClient = {
            getTOProgress: jest.fn(),
            claimBonusWins: jest.fn(),
            checkEligibility: jest.fn(),
            updatePlayerFinishedPromotion: jest.fn(),
        };
        mockAward = jest.fn();
        definition = new GameDefinition({ id: 1 });
        player = createPlayer();

        bonusWinConsumer = new BonusWinConsumer({
            definition,
            gamePromotionApiClient: { instance: () => apiClient },
            award: mockAward,
            logService: mockLogService,
            publisher: mockPublisher,
        });
    });

    describe("claim", () => {
        describe("successful claim", () => {
            beforeEach(() => {
                apiClient.getTOProgress.mockResolvedValue({ canClaim: true, totalWinAmount: 100 });
                apiClient.claimBonusWins.mockResolvedValue({
                    playerFinishedPromotionId: "finished-promo-id",
                    playerPromotionId: "player-promo-id",
                    claimedAmount: 100,
                    totalTurnover: 500,
                    minRequiredTurnover: 200,
                    totalWinAmount: 100,
                });
                mockAward.mockResolvedValue({ isOk: true, response: { seq: "test-seq" } });
                apiClient.checkEligibility.mockResolvedValue({ promotions: [] });
            });

            it("should complete claim flow and return result", async () => {
                const result = await bonusWinConsumer.claim(player);

                expect(apiClient.getTOProgress).toHaveBeenCalledWith({
                    playerId: "player-id",
                    promotionId: "promo-id",
                    operatorId: "operator-id",
                    siteName: "site-name",
                });
                expect(apiClient.claimBonusWins).toHaveBeenCalled();
                expect(mockAward).toHaveBeenCalledWith(player, expect.objectContaining({ amount: 100 }));
                expect(apiClient.updatePlayerFinishedPromotion).toHaveBeenCalled();
                expect(result).toEqual({
                    claimedAmount: 100,
                    totalTurnover: 500,
                    minRequiredTurnover: 200,
                    totalWinAmount: 100,
                });
                expect(player.promotion).toBeUndefined();
            });

            it("should set next promotion when available", async () => {
                const nextPromo = { _id: "next-promo", bonusItemCount: 5, endDate: null, isGiftCode: false };
                apiClient.checkEligibility.mockResolvedValue({ promotions: [nextPromo] });

                await bonusWinConsumer.claim(player);

                expect(player.promotion).toEqual({
                    promotionId: "next-promo",
                    remainingBonusItems: 5,
                    isActive: false,
                    endDate: null,
                    isGiftCode: false,
                    isClaimed: false,
                });
                expect(mockPublisher.publishToUser).toHaveBeenCalledWith("test-uid", { promotion: player.promotion });
            });

            it("should not publish when no next promotion", async () => {
                await bonusWinConsumer.claim(player);

                expect(mockPublisher.publishToUser).not.toHaveBeenCalled();
            });
        });

        describe("failure scenarios", () => {
            it("should return error when player has no promotion", async () => {
                delete player.promotion;

                const result = await bonusWinConsumer.claim(player);

                expect(result).toEqual({ errorCode: "SB3017" });
                expect(apiClient.getTOProgress).not.toHaveBeenCalled();
            });

            it("should return error when canClaim is false", async () => {
                apiClient.getTOProgress.mockResolvedValue({ canClaim: false });

                const result = await bonusWinConsumer.claim(player);

                expect(result).toEqual({ errorCode: "SB3017" });
                expect(apiClient.claimBonusWins).not.toHaveBeenCalled();
            });

            it("should return error from getTOProgress", async () => {
                apiClient.getTOProgress.mockResolvedValue({ errorCode: "PROGRESS_ERROR" });

                const result = await bonusWinConsumer.claim(player);

                expect(result).toEqual({ errorCode: "PROGRESS_ERROR" });
            });

            it("should clear promotion data for expired/claimed errors", async () => {
                apiClient.getTOProgress.mockResolvedValue({ errorCode: "SB3023" });
                player.promotionTOProgress = { data: "test" };

                await bonusWinConsumer.claim(player);

                expect(player.promotion).toBeUndefined();
                expect(player.promotionTOProgress).toBeUndefined();
            });

            it("should return error when claimBonusWins fails", async () => {
                apiClient.getTOProgress.mockResolvedValue({ canClaim: true, totalWinAmount: 100 });
                apiClient.claimBonusWins.mockResolvedValue({ errorCode: "CLAIM_ERROR" });

                const result = await bonusWinConsumer.claim(player);

                expect(result).toEqual({ errorCode: "SB3017" });
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should return error when award fails", async () => {
                apiClient.getTOProgress.mockResolvedValue({ canClaim: true, totalWinAmount: 100 });
                apiClient.claimBonusWins.mockResolvedValue({
                    playerPromotionId: "player-promo-id",
                    claimedAmount: 100,
                });
                mockAward.mockResolvedValue({ isOk: false, response: { apiError: { errorCode: "AWARD_ERROR" } } });

                const result = await bonusWinConsumer.claim(player);

                expect(result).toEqual({ errorCode: "AWARD_ERROR" });
                expect(player.promotion).toBeDefined(); // Should not clear on award failure
            });

            it("should handle exceptions and log errors", async () => {
                const testError = new Error("Test error");
                apiClient.getTOProgress.mockRejectedValue(testError);

                const result = await bonusWinConsumer.claim(player);

                expect(mockLogService.logError).toHaveBeenCalledWith(testError);
                expect(result).toEqual({ errorCode: "SB3017" });
            });
        });
    });

    describe("getPromotionAvailable", () => {
        it("should return formatted promotion data when promotion exists", async () => {
            const promotionData = {
                _id: "promo-123",
                bonusItemCount: 10,
                endDate: "2025-12-31",
                isGiftCode: true,
            };
            apiClient.checkEligibility.mockResolvedValue({ promotions: [promotionData] });

            const result = await bonusWinConsumer.getPromotionAvailable(player);

            expect(apiClient.checkEligibility).toHaveBeenCalledWith({
                playerId: "player-id",
                currencyGroup: "currency-group-id",
                operatorId: "operator-id",
                siteName: "site-name",
                gameId: definition.id,
            });
            expect(result).toEqual({
                promotionId: "promo-123",
                remainingBonusItems: 10,
                isActive: true,
                endDate: "2025-12-31",
                isGiftCode: true,
                isClaimed: false,
            });
        });

        it("should return null when no promotion available", async () => {
            apiClient.checkEligibility.mockResolvedValue({ promotions: [] });

            const result = await bonusWinConsumer.getPromotionAvailable(player);

            expect(result).toBeNull();
        });

        it("should propagate errors from checkEligibility", async () => {
            const error = new Error("API Error");
            apiClient.checkEligibility.mockRejectedValue(error);

            await expect(bonusWinConsumer.getPromotionAvailable(player)).rejects.toThrow("API Error");
        });
    });

    describe("clearPlayerPromotionData", () => {
        it("should delete promotion and promotionTOProgress", () => {
            player.promotionTOProgress = { data: "test" };

            bonusWinConsumer.clearPlayerPromotionData(player);

            expect(player.promotion).toBeUndefined();
            expect(player.promotionTOProgress).toBeUndefined();
        });
    });
});
