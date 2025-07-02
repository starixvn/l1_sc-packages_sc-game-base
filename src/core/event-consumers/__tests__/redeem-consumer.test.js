import RedeemConsumer from "../redeem-consumer";

describe("RedeemConsumer", () => {
    let redeemConsumer;
    let mockGameData;
    let mockPublisher;
    let mockLogService;
    let mockPromotionApiClient;
    let mockPromotionApiClientInstance;
    let player;

    beforeEach(() => {
        mockGameData = {
            gameConfigs: { gameId: "GAME_ID" }
        };
        mockPublisher = { publishToUser: jest.fn() };
        mockLogService = { logError: jest.fn() };
        mockPromotionApiClientInstance = {
            redeemGiftCode: jest.fn(),
            getPromotionById: jest.fn(),
            getTotalWin: jest.fn()
        };
        mockPromotionApiClient = {
            instance: () => mockPromotionApiClientInstance
        };
        player = {
            UID: "player1",
            session: {
                operatorId: "op1",
                siteName: "site1",
                playerId: "p1",
                currencyGroupId: "cg1"
            }
        };
        redeemConsumer = new RedeemConsumer(
            mockGameData,
            mockPublisher,
            {
                logService: mockLogService,
                gamePromotionApiClient: mockPromotionApiClient
            }
        );
        redeemConsumer.promotionApiClient = mockPromotionApiClientInstance;
    });

    it("should process redeem with valid gift code and update promotion", async () => {
        const payload = { giftCode: "VALID_CODE" };
        const promotionObj = { isClaimed: true, promotionId: "PROMO_ID", promotionCode: "CODE", remainingBonusItems: 2, initialBonusItem: 2, promotionType: "type", endDate: null, lastUsedDate: null, isGiftCode: true, betLevel: 1 };
        mockPromotionApiClientInstance.redeemGiftCode.mockResolvedValue({ success: true, promotion: promotionObj });
        mockPromotionApiClientInstance.getPromotionById.mockResolvedValue({ gameIds: ["GAME_ID"] });
        mockPromotionApiClientInstance.getTotalWin.mockResolvedValue(100);
        player.promotion = undefined;

        const spyUpdate = jest.spyOn(redeemConsumer, "updatePromotion");
        await redeemConsumer.processRedeem(player, payload);

        expect(mockPromotionApiClientInstance.redeemGiftCode).toHaveBeenCalledWith({
            giftCode: "VALID_CODE",
            operatorId: "op1",
            siteName: "site1",
            playerId: "p1",
            currencyGroup: "cg1"
        });
        expect(spyUpdate).toHaveBeenCalledWith(player, expect.objectContaining({ promotion: promotionObj }));
        expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
            "player1",
            expect.objectContaining({
                redeemResult: 1,
                promotion: promotionObj
            })
        );
        expect(player.promotion).toBeDefined();
        expect(player.promotion.promotionId).toBe("PROMO_ID");
        expect(player.promotion.totalWin).toBe(100);
    });

    it("should process redeem with invalid gift code and call sendRedeemError", async () => {
        const payload = { giftCode: "INVALID_CODE" };
        mockPromotionApiClientInstance.redeemGiftCode.mockResolvedValue({ success: false, code: "ERR", message: "Invalid" });
        await redeemConsumer.processRedeem(player, payload);
        expect(mockPublisher.publishToUser).toHaveBeenCalledWith(
            "player1",
            expect.objectContaining({
                redeemResult: -1,
                redemptionNotice: expect.objectContaining({ errorCode: "ERR", message: "Invalid" })
            })
        );
    });

    it("should update promotion for player if promotion is valid", async () => {
        const promotionObj = { promotionId: "PROMO_ID", promotionCode: "CODE", remainingBonusItems: 2, initialBonusItem: 2, promotionType: "type", endDate: null, lastUsedDate: null, isGiftCode: true, betLevel: 1 };
        const result = { promotion: promotionObj };
        mockPromotionApiClientInstance.getPromotionById.mockResolvedValue({ gameIds: ["GAME_ID"] });
        mockPromotionApiClientInstance.getTotalWin.mockResolvedValue(50);
        await redeemConsumer.updatePromotion(player, result);
        expect(player.promotion).toBeDefined();
        expect(player.promotion.promotionId).toBe("PROMO_ID");
        expect(player.promotion.totalWin).toBe(50);
    });

    it("should return notice object with error code and extra data", () => {
        const result = redeemConsumer.getNoticeObj("ERR", { message: "msg" });
        expect(result).toEqual({ errorCode: "ERR", message: "msg" });
    });
});
