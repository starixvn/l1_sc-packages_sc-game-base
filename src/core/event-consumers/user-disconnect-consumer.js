import { Socket } from "socket.io";

import GameData from "./../game-data";
import UserTrackingClient from "../communicators/user-tracking-client";

export default class UserDisconnectConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserTrackingClient} userTrackingClient
     */
    constructor(gameData, userTrackingClient) {
        this.gameData = gameData;
        this.userTrackingClient = userTrackingClient;
    }

    /**
     * @param {Socket} socketClient
     */
    consume(socketClient) {
        const userData = this.gameData.realPlayers[socketClient.id];

        if (userData?.session) {
            const sessionData = {
                sessionId: userData.session.sessionId,
                gameId: this.gameData.gameConfigs?.gameId ?? 0,
            };

            try {
                this.userTrackingClient.signOut(sessionData);
            } catch (error) {
                console.error("Failed to track user sign out:", error);
                console.log(sessionData);
            }
        }

        setTimeout(() => {
            delete this.gameData.realPlayers[socketClient.id];
        });
    }
}
