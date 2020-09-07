import { PlaceBetPublisher } from "../../core/event-publishers";

export default class TablePlaceBetPublisher extends PlaceBetPublisher {
    publishSuccessBet(playerId, payload) {
        const otherUsersPayload = {
            playerId,
            ...payload.ownChip,
            ...payload.user,
        };

        this.publishToUser(playerId, payload);
        this.publishToAllUsersExcept(playerId, { playerChip: otherUsersPayload });
    }
}
