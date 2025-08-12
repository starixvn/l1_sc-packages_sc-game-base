import { TrackingClient } from "@sc/user-tracking-client";

export default class UserTrackingClient {
    constructor(appConfigs) {
        this.client = new TrackingClient(appConfigs.tracking.baseURL, {
            headers: appConfigs.tracking.headers || {},
        });
    }

    async signIn(sessionData) {
        try {
            await this.client.signIn({ ...sessionData });
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

            return response.data;
        } catch (error) {
            console.error("Failed to track user game session:", error);
        }
    }
}
