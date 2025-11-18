export default class BonusWinConsumer {
    constructor({ definition, gamePromotionApiClient, award, logService, publisher }) {
        this.definition = definition;
        this.gamePromotionApiClient = gamePromotionApiClient.instance();
        this.award = award;
        this.logService = logService;
        this.publisher = publisher;
    }

    clearPlayerPromotionData(player) {
        delete player.promotion;
        delete player.promotionTOProgress;
    }

    async claim(player) {
        try {
            const { promotion } = player;
            if (!promotion) {
                return { errorCode: claimingErrorCodes.CLAIMING_FAILED };
            }

            const toProgress = await this.getTurnoverProgress(player);
            if (toProgress.errorCode) {
                return this.handleProgressError(player, toProgress.errorCode);
            }

            if (!toProgress.canClaim) {
                return { errorCode: claimingErrorCodes.CLAIMING_FAILED };
            }

            return await this.processClaim(player, toProgress);
        } catch (exception) {
            this.logService.logError(exception);
            return { errorCode: claimingErrorCodes.CLAIMING_FAILED };
        }
    }

    async getTurnoverProgress(player) {
        const { promotion, session } = player;
        return this.gamePromotionApiClient.getTOProgress({
            playerId: session.playerId,
            promotionId: promotion.promotionId,
            operatorId: session.operatorId,
            siteName: session.siteName,
        });
    }

    handleProgressError(player, errorCode) {
        if (
            errorCode === claimingErrorCodes.CLAIMING_EXPIRED ||
            errorCode === claimingErrorCodes.BONUS_ALREADY_CLAIMED
        ) {
            this.clearPlayerPromotionData(player);
        }
        return { errorCode };
    }

    async processClaim(player, toProgress) {
        const { promotion, session } = player;
        const claimBonusWinsResult = await this.gamePromotionApiClient.claimBonusWins({
            playerId: session.playerId,
            promotionId: promotion.promotionId,
            operatorId: session.operatorId,
            siteName: session.siteName,
        });

        if (claimBonusWinsResult.errorCode) {
            return { errorCode: claimingErrorCodes.CLAIMING_FAILED };
        }

        const { isOk, response } = await this.award(player, {
            playerId: session.playerId,
            siteId: session.siteId,
            operatorId: session.operatorId,
            currency: session.currencyName,
            promotionId: claimBonusWinsResult.playerPromotionId,
            gameId: this.definition.id,
            amount: toProgress.totalWinAmount,
        });

        if (!isOk) {
            return { errorCode: response.apiError.errorCode };
        }

        return this.finalizeSuccessfulClaim(player, claimBonusWinsResult, response);
    }

    async finalizeSuccessfulClaim(player, claimBonusWinsResult, awardResponse) {
        this.clearPlayerPromotionData(player);
        await this.gamePromotionApiClient.updatePlayerFinishedPromotion({
            playerFinishedPromotionId: claimBonusWinsResult.playerFinishedPromotionId,
            seq: awardResponse.seq,
        });

        const promotionAvailable = await this.getPromotionAvailable(player);
        if (promotionAvailable) {
            player.promotion = promotionAvailable;
            this.publisher.publishToUser(player.UID, { promotion: promotionAvailable });
        }

        return {
            claimedAmount: claimBonusWinsResult.claimedAmount,
            totalTurnover: claimBonusWinsResult.totalTurnover,
            minRequiredTurnover: claimBonusWinsResult.minRequiredTurnover,
            totalWinAmount: claimBonusWinsResult.totalWinAmount,
        };
    }

    async getPromotionAvailable(player) {
        const { session } = player;
        const { promotions } = await this.gamePromotionApiClient.checkEligibility({
            playerId: session.playerId,
            currencyGroup: session.currencyGroupId,
            operatorId: session.operatorId,
            siteName: session.siteName,
            gameId: this.definition.id,
        });
        if (promotions.length === 0) {
            return null;
        }
        return {
            promotionId: promotions[0]._id,
            remainingBonusItems: promotions[0].bonusItemCount,
            isActive: true,
            endDate: promotions[0].endDate,
            isGiftCode: promotions[0].isGiftCode,
            isClaimed: false,
        };
    }
}

const claimingErrorCodes = {
    CLAIMING_EXPIRED: "SB3023",
    CLAIMING_FAILED: "SB3017",
    BONUS_ALREADY_CLAIMED: "SB3018",
};
