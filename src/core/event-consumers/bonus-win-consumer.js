export default class BonusWinConsumer {
    constructor({ definition, gamePromotionApiClient, award }) {
        this.definition = definition;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
        this.award = award;
    }

    async claim(player) {
        const { promotion, session } = player;
        const toProgress = await this.gamePromotionApiClient.getTOProgress({
            playerId: session.playerId,
            promotionId: promotion.promotionId,
            operatorId: session.operatorId,
            siteName: session.siteName,
        });

        if (toProgress.success && toProgress.canClaim) {
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
                return this.gamePromotionApiClient.claimBonusWins({
                    playerId: session.playerId,
                    promotionId: promotion.promotionId,
                    operatorId: session.operatorId,
                    siteName: session.siteName,
                });
            }
            return {
                success: false,
                errorCode: response.apiError.errorCode,
            };
        }

        return {
            success: false,
            errorCode: toProgress.errorCode,
        };
    }
}
