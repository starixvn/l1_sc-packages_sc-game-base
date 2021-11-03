import { Systems } from "../../constants/systems";
import { PlaceBetPublisher } from "./../../core/event-publishers";

export default class TablePlaceBetPublisher extends PlaceBetPublisher {
    publishSuccessBet(playerId, payload, rate) {
        super.publishSuccessBet(playerId, payload);

        const otherUsersPayload = {
            playerId,
            rate,
            ...payload.ownChip,
            ...payload.user,
        };

        this.publishToAllUsersExceptSystem(Systems.Mobi, playerId, { playerChip: otherUsersPayload });
    }
}
