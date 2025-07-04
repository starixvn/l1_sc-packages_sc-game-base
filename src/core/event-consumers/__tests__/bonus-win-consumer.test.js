import GameDefinition from "../../game-definition";
import BonusWinConsumer from "../bonus-win-consumer";

describe("BonusWinConsumer", () => {
    let bonusWinConsumer;

    let player;
    const definition = new GameDefinition({ id: 1 });
    const gamePromotionApiClientInstance = {
        getTOProgress: jest.fn(),
        claimBonusWins: jest.fn(),
    };

    const gamePromotionApiClient = {
        instance: () => gamePromotionApiClientInstance,
    };

    const mockAward = jest.fn();
    beforeEach(() => {
        player = {
            promotion: {
                promotionId: "test-promotion-id",
            },
            session: {
                playerId: "test-player-id",
                operatorId: "test-operator-id",
                siteName: "test-site-name",
                siteId: "test-site-id",
                currencyName: "USD",
            },
        };

        bonusWinConsumer = new BonusWinConsumer({
            definition: definition,
            gamePromotionApiClient,
            award: mockAward,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("claim", () => {
        describe("when getTOProgress succeeds and canClaim is true", () => {
            describe("when award succeeds", () => {
                describe("when claimBonusWins succeeds", () => {
                    it("should call getTOProgress with correct parameters", async () => {
                        // Arrange
                        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                            success: true,
                            canClaim: true,
                            totalWinAmount: 100,
                        });
                        mockAward.mockResolvedValue({ isOk: true });
                        gamePromotionApiClientInstance.claimBonusWins.mockResolvedValue({
                            success: true,
                        });

                        // Act
                        await bonusWinConsumer.claim(player);

                        // Assert
                        expect(gamePromotionApiClientInstance.getTOProgress).toHaveBeenCalledWith({
                            playerId: "test-player-id",
                            promotionId: "test-promotion-id",
                            operatorId: "test-operator-id",
                            siteName: "test-site-name",
                        });
                    });

                    it("should call award with correct parameters", async () => {
                        // Arrange
                        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                            success: true,
                            canClaim: true,
                            totalWinAmount: 100,
                        });
                        mockAward.mockResolvedValue({ isOk: true });
                        gamePromotionApiClientInstance.claimBonusWins.mockResolvedValue({
                            success: true,
                        });

                        // Act
                        await bonusWinConsumer.claim(player);

                        // Assert
                        expect(mockAward).toHaveBeenCalledWith(player, {
                            playerId: "test-player-id",
                            siteId: "test-site-id",
                            operatorId: "test-operator-id",
                            currency: "USD",
                            promotionId: "test-promotion-id",
                            gameId: definition.id,
                            amount: 100,
                        });
                    });

                    it("should call claimBonusWins with correct parameters", async () => {
                        // Arrange
                        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                            success: true,
                            canClaim: true,
                            totalWinAmount: 100,
                        });
                        mockAward.mockResolvedValue({ isOk: true });
                        gamePromotionApiClientInstance.claimBonusWins.mockResolvedValue({
                            success: true,
                        });

                        // Act
                        await bonusWinConsumer.claim(player);

                        // Assert
                        expect(gamePromotionApiClientInstance.claimBonusWins).toHaveBeenCalledWith({
                            playerId: "test-player-id",
                            promotionId: "test-promotion-id",
                            operatorId: "test-operator-id",
                            siteName: "test-site-name",
                        });
                    });

                    it("should return claimBonusWins result", async () => {
                        // Arrange
                        const expectedResult = { success: true, claimId: "claim-123" };
                        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                            success: true,
                            canClaim: true,
                            totalWinAmount: 100,
                        });
                        mockAward.mockResolvedValue({ isOk: true });
                        gamePromotionApiClientInstance.claimBonusWins.mockResolvedValue(expectedResult);

                        // Act
                        const result = await bonusWinConsumer.claim(player);

                        // Assert
                        expect(result).toEqual(expectedResult);
                    });
                });
            });

            describe("when award fails", () => {
                it("should return failure result with error code from award response", async () => {
                    // Arrange
                    gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                        success: true,
                        canClaim: true,
                        totalWinAmount: 100,
                    });
                    mockAward.mockResolvedValue({
                        isOk: false,
                        response: {
                            apiError: {
                                errorCode: "AWARD_FAILED",
                            },
                        },
                    });

                    // Act
                    const result = await bonusWinConsumer.claim(player);

                    // Assert
                    expect(result).toEqual({
                        success: false,
                        errorCode: "AWARD_FAILED",
                    });
                });

                it("should not call claimBonusWins when award fails", async () => {
                    // Arrange
                    gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                        success: true,
                        canClaim: true,
                        totalWinAmount: 100,
                    });
                    mockAward.mockResolvedValue({
                        isOk: false,
                        response: {
                            apiError: {
                                errorCode: "AWARD_FAILED",
                            },
                        },
                    });

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
                });
            });
        });

        describe("when getTOProgress succeeds but canClaim is false", () => {
            it("should return failure result with error code from getTOProgress", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: true,
                    canClaim: false,
                    errorCode: "CANNOT_CLAIM",
                });

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({
                    success: false,
                    errorCode: "CANNOT_CLAIM",
                });
            });

            it("should not call award when canClaim is false", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: true,
                    canClaim: false,
                    errorCode: "CANNOT_CLAIM",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when canClaim is false", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: true,
                    canClaim: false,
                    errorCode: "CANNOT_CLAIM",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });
        });

        describe("when getTOProgress fails", () => {
            it("should return failure result with error code from getTOProgress", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: false,
                    errorCode: "PROGRESS_FAILED",
                });

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({
                    success: false,
                    errorCode: "PROGRESS_FAILED",
                });
            });

            it("should not call award when getTOProgress fails", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: false,
                    errorCode: "PROGRESS_FAILED",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when getTOProgress fails", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    success: false,
                    errorCode: "PROGRESS_FAILED",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });
        });
    });
});
