import BaseEventPublisher from "./base-event-publisher";

export default class PromotionFreeSpinsPublisher extends BaseEventPublisher {
    publishEndPromotion(players) {
        for (const player of players) {
            this.publishToUserByPlayerId(player.playerId, { 
                finishPromotion : {
                    endPromotion: true,
                    totalWin: player.totalWin,
                }
            });
        }
    }

    publishExpiredPromotion(players) {
        for (const player of players) {
            this.publishToUserByPlayerId(player.playerId, { 
                errorCode: "SB3030"
            });
        }
    }
}
