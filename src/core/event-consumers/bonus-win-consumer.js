export default class BonusWinConsumer {
    constructor({ definition, gamePromotionApiClient, award, logService }) {
        this.definition = definition;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
        this.award = award;
        this.logService = logService;
    }

    clearPlayerPromotionData(player) {
        delete player.promotion;
        delete player.promotionTOProgress;
    }

    async claim(player) {
        try {
            const { promotion, session } = player;
            if (promotion) {
                const toProgress = await this.gamePromotionApiClient.getTOProgress({
                    playerId: session.playerId,
                    promotionId: promotion.promotionId,
                    operatorId: session.operatorId,
                    siteName: session.siteName,
                });

                if (toProgress.errorCode) {
                    if (
                        toProgress.errorCode === claimingErrorCodes.CLAIMING_EXPIRED ||
                        toProgress.errorCode === claimingErrorCodes.BONUS_ALREADY_CLAIMED
                    ) {
                        this.clearPlayerPromotionData(player);
                    }

                    return {
                        errorCode: toProgress.errorCode,
                    };
                }

                if (toProgress.canClaim) {
                    const claimBonusWinsResult = await this.gamePromotionApiClient.claimBonusWins({
                        playerId: session.playerId,
                        promotionId: promotion.promotionId,
                        operatorId: session.operatorId,
                        siteName: session.siteName,
                    });

                    if (claimBonusWinsResult.errorCode) {
                        return {
                            errorCode: claimingErrorCodes.CLAIMING_FAILED,
                        };
                    }

                    const { isOk, response } = await this.award(player, {
                        playerId: session.playerId,
                        siteId: session.siteId,
                        operatorId: session.operatorId,
                        currency: session.currencyName,
                        promotionId: promotion.promotionId,
                        gameId: this.definition.id,
                        amount: toProgress.totalWinAmount,
                    });

                    if (isOk) {
                        this.clearPlayerPromotionData(player);
                        return claimBonusWinsResult;
                    }

                    return {
                        errorCode: response.apiError.errorCode,
                    };
                }
            }

            return {
                errorCode: claimingErrorCodes.CLAIMING_FAILED,
            };
        } catch (exception) {
            this.logService.logError(exception);
            return {
                errorCode: claimingErrorCodes.CLAIMING_FAILED,
            };
        }
    }
}

const claimingErrorCodes = {
    CLAIMING_EXPIRED: "SB3023",
    CLAIMING_FAILED: "SB3017",
    BONUS_ALREADY_CLAIMED: "SB3018",
};
