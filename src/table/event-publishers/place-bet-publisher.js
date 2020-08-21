import { PlaceBetPublisher } from "./../../core/event-publishers";

export default class TablePlaceBetPublisher extends PlaceBetPublisher {
    publishSuccessBet(payload) {
        const toCurrentOtherUsersPayload = {
            playerId: payload.playerId,
            ...payload.ownChip,
            ...payload.user,
        };

        this.publishToUser(payload.userId, { ownChip: payload });
        this.publishToAllUsersExcept(payload.userId, { playerChip: toCurrentOtherUsersPayload });
    }
}
