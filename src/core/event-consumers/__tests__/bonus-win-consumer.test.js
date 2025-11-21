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
    let mockPromotionAssignmentConsumer;

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

        // Mock PromotionAssignmentConsumer
        mockPromotionAssignmentConsumer = {
            clearPromotionData: jest.fn((player) => {
                delete player.promotion;
                delete player.promotionTOProgress;
            }),
            assignNextPromotion: jest.fn(),
        };

        bonusWinConsumer = new BonusWinConsumer({
            definition,
            gamePromotionApiClient: { instance: () => apiClient },
            award: mockAward,
            logService: mockLogService,
            publisher: mockPublisher,
            promotionAssignmentConsumer: mockPromotionAssignmentConsumer,
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

            it("should call assignNextPromotion when claim succeeds", async () => {
                await bonusWinConsumer.claim(player);

                expect(mockPromotionAssignmentConsumer.assignNextPromotion).toHaveBeenCalledWith(player, {
                    clearExisting: false,
                    publishToClient: true,
                });
            });

            it("should clear promotion data before assigning next promotion", async () => {
                await bonusWinConsumer.claim(player);

                expect(mockPromotionAssignmentConsumer.clearPromotionData).toHaveBeenCalledWith(player);
                expect(mockPromotionAssignmentConsumer.assignNextPromotion).toHaveBeenCalled();
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

    describe("clearPlayerPromotionData", () => {
        it("should delegate to promotionAssignmentConsumer.clearPromotionData", () => {
            player.promotionTOProgress = { data: "test" };

            bonusWinConsumer.clearPlayerPromotionData(player);

            expect(mockPromotionAssignmentConsumer.clearPromotionData).toHaveBeenCalledWith(player);
            expect(player.promotion).toBeUndefined();
            expect(player.promotionTOProgress).toBeUndefined();
        });
    });
});
