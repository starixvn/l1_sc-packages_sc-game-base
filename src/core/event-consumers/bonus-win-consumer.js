export default class BonusWinConsumer {
    constructor({ definition, gamePromotionApiClient, award, logService }) {
        this.definition = definition;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
        this.award = award;
        this.logService = logService;
    }

    async claim(player) {
        try {
            const { promotion, session } = player;
            const toProgress = await this.gamePromotionApiClient.getTOProgress({
                playerId: session.playerId,
                promotionId: promotion.promotionId,
                operatorId: session.operatorId,
                siteName: session.siteName,
            });

            if (toProgress.errorCode) {
                return {
                    errorCode: toProgress.errorCode,
                };
            }

            if (toProgress.canClaim) {
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
                    delete player.promotion;
                    delete player.promotionTOProgress;

                    return this.gamePromotionApiClient.claimBonusWins({
                        playerId: session.playerId,
                        promotionId: promotion.promotionId,
                        operatorId: session.operatorId,
                        siteName: session.siteName,
                    });
                }

                return {
                    errorCode: response.apiError.errorCode,
                };
            }

            return {
                errorCode: "SB3017",
            };
        } catch (exception) {
            this.logService.logError(exception);
            return {
                errorCode: "SB0001",
            };
        }
    }
}
