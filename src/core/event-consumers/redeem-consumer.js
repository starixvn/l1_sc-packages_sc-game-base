import { Socket } from "socket.io";

import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { PromotionClient } from "./../promotion-client";

export default class RedeemConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {BaseEventPublisher} dependencies.publisher
     * @param {*} dependencies.logService
     * @param {PromotionClient} [dependencies.gamePromotionApiClient]
     */
    constructor({ definition, gameData, publisher, logService, gamePromotionApiClient }) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher;
        this.logService = logService;
        this.promotionApiClient = gamePromotionApiClient?.instance?.() || gamePromotionApiClient;
    }

    /**
     * @param {Object} player - Player object
     * @param {Object} payload - Redeem payload (giftCode)
     */
    async consume(player, payload) {
        try {
            await this.processRedeem(player, payload);
        } catch (error) {
            this.logService?.logError(`Error in redeem consumer for player ${player.profile.name}:`, error);
            this.publisher.publishToUser(player.UID, {
                redeemResult: -1,
                notice: this.getNoticeObj("Unexpected_gift_code_error_message", {
                    message: "Unexpected error occurred. Please try redeeming your gift code again later.",
                }),
            });
        }
    }

    /**
     * Hàm gửi lỗi về client, tránh lặp code
     */
    sendRedeemError(player, errorCode, message) {
        this.publisher.publishToUser(player.UID, {
            redeemResult: -1,
            notice: this.getNoticeObj(errorCode, { message }),
        });
    }

    /**
     * @param {Object} player
     * @param {Object} payload
     */
    async processRedeem(player, payload) {
        const result = await this.promotionApiClient.redeemGiftCode({
            giftCode: payload.giftCode,
            operatorId: player.session?.operatorId,
            siteName: player.session?.siteName,
            playerId: player.session?.playerId,
            currencyGroup: player.session?.currencyGroup,
        });

        if(result.success) {
            this.publisher.publishToUser(player.UID, {
                redeemResult: 1,
                notice: this.getNoticeObj("REDEEM_SUCCESS", {
                    message: "Redeem successful!",
                }),
            });
        }
        else {
            this.sendRedeemError(player, result.errorCode, result.message);
        }       
    }

    /**
     * Tạo notice object trả về client
     * @param {string} errorCode
     * @param {Object} extraData
     * @returns {Object}
     */
    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }
}
