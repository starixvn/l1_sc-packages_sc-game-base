import { PlaceBetPublisher } from "./../../core/event-publishers";

export default class TablePlaceBetPublisher extends PlaceBetPublisher {
    publishSuccessBet(playerId, payload) {
        const toCurrentOtherUsersPayload = {
            playerId,
            ...payload.ownChip,
            ...payload.user,
        };

        this.publishToUser(playerId, payload);
        this.publishToAllUsersExcept(playerId, { playerChip: toCurrentOtherUsersPayload });
    }
}
