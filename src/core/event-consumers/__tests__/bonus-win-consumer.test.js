import GameDefinition from "../../game-definition";
import BonusWinConsumer from "../bonus-win-consumer";

describe("BonusWinConsumer", () => {
    let bonusWinConsumer;
    let mockLogService;
    let player;
    let gamePromotionApiClientInstance;
    let gamePromotionApiClient;
    let mockAward;
    let definition;

    // Test constants
    const TEST_PLAYER_ID = "test-player-id";
    const TEST_PROMOTION_ID = "test-promotion-id";
    const TEST_OPERATOR_ID = "test-operator-id";
    const TEST_SITE_NAME = "test-site-name";
    const TEST_SITE_ID = "test-site-id";

    // Test Data Factories
    const createPlayer = (overrides = {}) => ({
        UID: "test-uid",
        promotion: {
            promotionId: TEST_PROMOTION_ID,
        },
        session: {
            playerId: TEST_PLAYER_ID,
            operatorId: TEST_OPERATOR_ID,
            siteName: TEST_SITE_NAME,
            siteId: TEST_SITE_ID,
            currencyName: "USD",
            currencyGroupId: "test-currency-group-id",
        },
        ...overrides,
    });

    const createSuccessfulTOProgress = (overrides = {}) => ({
        canClaim: true,
        totalWinAmount: 100,
        ...overrides,
    });

    const createFailedTOProgress = (errorCode) => ({
        errorCode,
    });

    const createSuccessfulAwardResponse = () => ({
        isOk: true,
    });

    const createFailedAwardResponse = (errorCode = "AWARD_FAILED") => ({
        isOk: false,
        response: {
            apiError: {
                errorCode,
            },
        },
    });

    const createClaimBonusWinsResult = (overrides = {}) => ({
        success: true,
        claimId: "claim-123",
        ...overrides,
    });

    // Setup Helpers
    const setupSuccessfulTOProgress = (toProgressData = {}) => {
        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue(
            createSuccessfulTOProgress(toProgressData)
        );
    };

    const setupFailedTOProgress = (errorCode) => {
        gamePromotionApiClientInstance.getTOProgress.mockResolvedValue(
            createFailedTOProgress(errorCode)
        );
    };

    const setupSuccessfulAward = () => {
        mockAward.mockResolvedValue(createSuccessfulAwardResponse());
    };

    const setupFailedAward = (errorCode) => {
        mockAward.mockResolvedValue(createFailedAwardResponse(errorCode));
    };

    const setupSuccessfulClaimBonusWins = (resultData = {}) => {
        gamePromotionApiClientInstance.claimBonusWins.mockReturnValue(
            createClaimBonusWinsResult(resultData)
        );
    };

    const setupClaimBonusWinsWithError = (errorCode) => {
        gamePromotionApiClientInstance.claimBonusWins.mockReturnValue({
            errorCode,
        });
    };

    beforeEach(() => {
        // Arrange - Create fresh mocks for each test
        mockLogService = {
            logError: jest.fn(),
        };

        gamePromotionApiClientInstance = {
            getTOProgress: jest.fn(),
            claimBonusWins: jest.fn(),
            checkEligibility: jest.fn(),
        };

        gamePromotionApiClient = {
            instance: () => gamePromotionApiClientInstance,
        };

        mockAward = jest.fn();
        definition = new GameDefinition({ id: 1 });
        player = createPlayer();

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
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins();

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(gamePromotionApiClientInstance.getTOProgress).toHaveBeenCalledWith({
                        playerId: TEST_PLAYER_ID,
                        promotionId: TEST_PROMOTION_ID,
                        operatorId: TEST_OPERATOR_ID,
                        siteName: TEST_SITE_NAME,
                    });
                });

                it("should call award with correct parameters", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins();

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(mockAward).toHaveBeenCalledWith(player, {
                        playerId: TEST_PLAYER_ID,
                        siteId: TEST_SITE_ID,
                        operatorId: TEST_OPERATOR_ID,
                        currency: "USD",
                        promotionId: TEST_PROMOTION_ID,
                        gameId: definition.id,
                        amount: 100,
                    });
                });

                it("should call claimBonusWins with correct parameters", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins();

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(gamePromotionApiClientInstance.claimBonusWins).toHaveBeenCalledWith({
                        playerId: TEST_PLAYER_ID,
                        promotionId: TEST_PROMOTION_ID,
                        operatorId: TEST_OPERATOR_ID,
                        siteName: TEST_SITE_NAME,
                    });
                });

                it("should return claimBonusWins result", async () => {
                    // Arrange
                    const expectedResult = createClaimBonusWinsResult();
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins(expectedResult);

                    // Act
                    const result = await bonusWinConsumer.claim(player);

                    // Assert
                    expect(result).toEqual(expectedResult);
                });

                it("should clear player promotion data after successful claim", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins();

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotion).toBeUndefined();
                });

                it("should clear player promotionTOProgress data after successful claim", async () => {
                    // Arrange
                    player.promotionTOProgress = { someData: "test" };
                    setupSuccessfulTOProgress();
                    setupSuccessfulAward();
                    setupSuccessfulClaimBonusWins();

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotionTOProgress).toBeUndefined();
                });
            });

            describe("when award fails", () => {
                it("should return error code from award response", async () => {
                    // Arrange
                    const errorCode = "AWARD_FAILED";
                    setupSuccessfulTOProgress();
                    setupSuccessfulClaimBonusWins();
                    setupFailedAward(errorCode);

                    // Act
                    const result = await bonusWinConsumer.claim(player);

                    // Assert
                    expect(result).toEqual({ errorCode });
                });

                it("should call claimBonusWins before award", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupSuccessfulClaimBonusWins();
                    setupFailedAward("AWARD_FAILED");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(gamePromotionApiClientInstance.claimBonusWins).toHaveBeenCalled();
                });

                it("should not clear player promotion data when award fails", async () => {
                    // Arrange
                    const originalPromotion = { ...player.promotion };
                    setupSuccessfulTOProgress();
                    setupSuccessfulClaimBonusWins();
                    setupFailedAward("AWARD_FAILED");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotion).toEqual(originalPromotion);
                });
            });

            describe("when claimBonusWins fails", () => {
                it("should return SB3017 error code when claimBonusWins returns error", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupClaimBonusWinsWithError("CLAIM_ERROR");

                    // Act
                    const result = await bonusWinConsumer.claim(player);

                    // Assert
                    expect(result).toEqual({ errorCode: "SB3017" });
                });

                it("should not call award when claimBonusWins returns error", async () => {
                    // Arrange
                    setupSuccessfulTOProgress();
                    setupClaimBonusWinsWithError("CLAIM_ERROR");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(mockAward).not.toHaveBeenCalled();
                });
            });
        });

        describe("when getTOProgress succeeds but canClaim is false", () => {
            it("should return SB3017 error code", async () => {
                // Arrange
                setupSuccessfulTOProgress({ canClaim: false });

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({ errorCode: "SB3017" });
            });

            it("should not call award when canClaim is false", async () => {
                // Arrange
                setupSuccessfulTOProgress({ canClaim: false });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when canClaim is false", async () => {
                // Arrange
                setupSuccessfulTOProgress({ canClaim: false });

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });
        });

        describe("when getTOProgress returns an error code", () => {
            it("should return the error code from getTOProgress", async () => {
                // Arrange
                const errorCode = "PROGRESS_ERROR";
                setupFailedTOProgress(errorCode);

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({ errorCode });
            });

            it("should not call award when getTOProgress returns error code", async () => {
                // Arrange
                setupFailedTOProgress("PROGRESS_ERROR");

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(mockAward).not.toHaveBeenCalled();
            });

            it("should not call claimBonusWins when getTOProgress returns error code", async () => {
                // Arrange
                setupFailedTOProgress("PROGRESS_ERROR");

                // Act
                await bonusWinConsumer.claim(player);

                // Assert
                expect(gamePromotionApiClientInstance.claimBonusWins).not.toHaveBeenCalled();
            });

            describe("when error is claiming expired", () => {
                it("should clear player promotion data", async () => {
                    // Arrange
                    setupFailedTOProgress("SB3023");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotion).toBeUndefined();
                });

                it("should clear player promotionTOProgress data", async () => {
                    // Arrange
                    player.promotionTOProgress = { someData: "test" };
                    setupFailedTOProgress("SB3023");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotionTOProgress).toBeUndefined();
                });
            });

            describe("when error is bonus already claimed", () => {
                it("should clear player promotion data", async () => {
                    // Arrange
                    setupFailedTOProgress("SB3018");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotion).toBeUndefined();
                });

                it("should clear player promotionTOProgress data", async () => {
                    // Arrange
                    player.promotionTOProgress = { someData: "test" };
                    setupFailedTOProgress("SB3018");

                    // Act
                    await bonusWinConsumer.claim(player);

                    // Assert
                    expect(player.promotionTOProgress).toBeUndefined();
                });
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

            it("should return SB3017 error code when exception occurs", async () => {
                // Arrange
                gamePromotionApiClientInstance.getTOProgress.mockRejectedValue(new Error("Test error"));

                // Act
                const result = await bonusWinConsumer.claim(player);

                // Assert
                expect(result).toEqual({ errorCode: "SB3017" });
            });
        });
    });

    describe("clearPlayerPromotionData", () => {
        it("should delete promotion property from player", () => {
            // Arrange
            player.promotion = { promotionId: "test" };

            // Act
            bonusWinConsumer.clearPlayerPromotionData(player);

            // Assert
            expect(player.promotion).toBeUndefined();
        });

        it("should delete promotionTOProgress property from player", () => {
            // Arrange
            player.promotionTOProgress = { someData: "test" };

            // Act
            bonusWinConsumer.clearPlayerPromotionData(player);

            // Assert
            expect(player.promotionTOProgress).toBeUndefined();
        });
    });

    describe("getPromotionAvailable", () => {
        const createEligibilityResponse = (overrides = {}) => ({
            promotions: [
                {
                    _id: "promo-123",
                    gameIds: [1],
                    bonusItemCount: 10,
                    endDate: new Date(Date.now() + 86400000).toISOString(),
                    isGiftCode: false,
                    ...overrides,
                },
            ],
        });

        describe("when checkEligibility succeeds with valid promotion", () => {
            it("should call checkEligibility with correct parameters", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse();
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(gamePromotionApiClientInstance.checkEligibility).toHaveBeenCalledWith({
                    playerId: TEST_PLAYER_ID,
                    currencyGroup: "test-currency-group-id",
                    operatorId: TEST_OPERATOR_ID,
                    siteName: TEST_SITE_NAME,
                });
            });

            it("should return promotion data when valid promotion exists for game", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse();
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual({
                    promotionId: "promo-123",
                    remainingBonusItems: 10,
                    isActive: true,
                    endDate: expect.any(String),
                    isGiftCode: false,
                    isClaimed: false,
                });
            });

            it("should set isActive correctly when promotion has endDate in future", async () => {
                // Arrange
                const futureDate = new Date(Date.now() + 86400000).toISOString();
                const eligibilityResponse = createEligibilityResponse({
                    endDate: futureDate,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        isActive: true,
                        endDate: futureDate,
                    })
                );
            });

            it("should set isActive correctly when promotion has endDate in past", async () => {
                // Arrange
                const pastDate = new Date(Date.now() - 86400000).toISOString();
                const eligibilityResponse = createEligibilityResponse({
                    endDate: pastDate,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        isActive: false,
                        endDate: pastDate,
                    })
                );
            });

            it("should set isActive to true when promotion has no endDate", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse({
                    endDate: null,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        isActive: true,
                        endDate: null,
                    })
                );
            });

            it("should return promotion data with correct isGiftCode value", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse({
                    isGiftCode: true,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        isGiftCode: true,
                        isClaimed: false,
                    })
                );
            });
        });

        describe("when checkEligibility returns no promotions", () => {
            it("should return null when promotions array is empty", async () => {
                // Arrange
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue({
                    promotions: [],
                });

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

            it("should return null when promotions is null", async () => {
                // Arrange
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue({
                    promotions: null,
                });

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

            it("should return null when promotionData is null", async () => {
                // Arrange
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(null);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

        });

        describe("when no valid promotion for game", () => {
            it("should return null when promotion gameIds does not include game id", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse({
                    gameIds: [2, 3],
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

            it("should return null when promotion has no gameIds", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse({
                    gameIds: null,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

            it("should return null when promotion has empty gameIds array", async () => {
                // Arrange
                const eligibilityResponse = createEligibilityResponse({
                    gameIds: [],
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toBeNull();
            });

            it("should return first valid promotion when multiple promotions exist", async () => {
                // Arrange
                const eligibilityResponse = {
                    promotions: [
                        {
                            _id: "promo-1",
                            gameIds: [2],
                            bonusItemCount: 5,
                            endDate: null,
                            isGiftCode: false,
                        },
                        {
                            _id: "promo-2",
                            gameIds: [1],
                            bonusItemCount: 10,
                            endDate: null,
                            isGiftCode: true,
                        },
                    ],
                };
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual({
                    promotionId: "promo-2",
                    remainingBonusItems: 10,
                    isActive: true,
                    endDate: null,
                    isGiftCode: true,
                    isClaimed: false,
                });
            });
        });

        describe("when checkEligibility throws an error", () => {
            it("should propagate the error", async () => {
                // Arrange
                const testError = new Error("API Error");
                gamePromotionApiClientInstance.checkEligibility.mockRejectedValue(testError);

                // Act & Assert
                await expect(bonusWinConsumer.getPromotionAvailable(player)).rejects.toThrow("API Error");
            });

            it("should propagate network errors", async () => {
                // Arrange
                const networkError = new Error("Network timeout");
                gamePromotionApiClientInstance.checkEligibility.mockRejectedValue(networkError);

                // Act & Assert
                await expect(bonusWinConsumer.getPromotionAvailable(player)).rejects.toThrow("Network timeout");
            });
        });

        describe("edge cases", () => {
            it("should handle promotion with string endDate", async () => {
                // Arrange
                const futureDateString = new Date(Date.now() + 86400000).toISOString();
                const eligibilityResponse = createEligibilityResponse({
                    endDate: futureDateString,
                });
                gamePromotionApiClientInstance.checkEligibility.mockResolvedValue(eligibilityResponse);

                // Act
                const result = await bonusWinConsumer.getPromotionAvailable(player);

                // Assert
                expect(result).toEqual(
                    expect.objectContaining({
                        isActive: true,
                        endDate: futureDateString,
                    })
                );
            });
        });
    });
});
