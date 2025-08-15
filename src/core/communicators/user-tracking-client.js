import { TrackingClient } from "@sc/user-tracking-client";

export default class UserTrackingClient {
    constructor(appConfigs) {
        this.client = new TrackingClient(appConfigs.trackingApiSettings.baseUrl, {
            headers: appConfigs.trackingApiSettings.headers || {},
        });
    }

    async signIn(sessionData) {
        try {
            const response = await this.client.signIn({ ...sessionData });

            console.log(response);
        } catch (error) {
            console.error("Failed to track user game session:", error);
        }
    }

    async signOut({ sessionId, gameId }) {
        try {
            const response = await this.client.signOut({
                sessionId,
                gameId,
            });

            console.log(response);
        } catch (error) {
            console.error("Failed to track user game session:", error);
        }
    }
}
