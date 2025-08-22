import GameDefinition from "../../game-definition";
import BonusWinConsumer from "../bonus-win-consumer";

describe("BonusWinConsumer", () => {
    let bonusWinConsumer;
    let mockLogService;
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
        mockLogService = {
            logError: jest.fn(),
        };

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
            definition,
            gamePromotionApiClient,
            award: mockAward,
            logService: mockLogService,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("claim", () => {
        describe("when getTOProgress succeeds and canClaim is true", () => {
            describe("when award succeeds", () => {
                it("should call getTOProgress with correct parameters", async () => {
                    // Arrange
                    gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
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

            describe("when award fails", () => {
                it("should return error code from award response", async () => {
                    // Arrange
                    gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
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
                        errorCode: "AWARD_FAILED",
                    });
                });

                it("should not call claimBonusWins when award fails", async () => {
                    // Arrange
                    gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
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
            it("should return SB3017 error code", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    canClaim: false,
                });

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({
                    errorCode: "SB3017",
                });
            });

            it("should not call award when canClaim is false", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    canClaim: false,
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when canClaim is false", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    canClaim: false,
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });
        });

        describe("when getTOProgress returns an error code", () => {
            it("should return the error code from getTOProgress", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    errorCode: "PROGRESS_ERROR",
                });

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({
                    errorCode: "PROGRESS_ERROR",
                });
            });

            it("should not call award when getTOProgress returns error code", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    errorCode: "PROGRESS_ERROR",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when getTOProgress returns error code", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockResolvedValue({
                    errorCode: "PROGRESS_ERROR",
                });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });
        });

        describe("when an exception occurs", () => {
            it("should log the exception", async () => {
                // Arrange
                const testError = new Error("Test error");
                gamePromotionApiClientInstance.getTOProgress.mockRejectedValue(testError);

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockLogService.logError).toHaveBeenCalledWith(testError);
            });

            it("should return SB0001 error code when exception occurs", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockRejectedValue(new Error("Test error"));

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({
                    errorCode: "SB3017",
                });
            });
        });
    });
});
