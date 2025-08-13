import { Socket } from "socket.io";

import { Systems } from "../../constants";
import UserDisconnectConsumer from "../../core/event-consumers/user-disconnect-consumer";
import BaseEventPublisher from "../../core/event-publishers/base-event-publisher";
import UserTrackingClient from "../../core/communicators/user-tracking-client";
import TableGameData from "../table-game-data";

export default class TableOutGameConsumer extends UserDisconnectConsumer {
    /**
     * @param {TableGameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {UserTrackingClient} userTrackingClient
     */
    constructor(gameData, publisher, userTrackingClient) {
        super(gameData, userTrackingClient);

        this.publisher = publisher;
    }

    /**
     * @param {Socket} socketClient
     */
    consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            this.publisher.publishToAllUsersExceptSystem(Systems.Mobi, realPlayer.UID, { outgame: { playerId: realPlayer.UID } });
            delete this.gameData.players[realPlayer.UID];
        }

        super.consume(socketClient);
    }
}
