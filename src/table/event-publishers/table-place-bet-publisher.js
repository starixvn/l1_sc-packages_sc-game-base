import { PlaceBetPublisher } from "./../../core/event-publishers";

export default class TablePlaceBetPublisher extends PlaceBetPublisher {
    publishSuccessBet(playerId, payload) {
        super.publishSuccessBet(playerId, payload);

        const otherUsersPayload = {
            playerId,
            ...payload.ownChip,
            ...payload.user,
        };

        this.publishToAllUsersExcept(playerId, { playerChip: otherUsersPayload });
    }
}
