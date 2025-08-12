import { createClient, userGameSessionControllerSignIn, userGameSessionControllerSignOut } from "@sc/user-tracking-client";

export default class UserTrackingClient {
    constructor(appConfigs) {
        this.client = createClient({
            baseURL: appConfigs.tracking.baseURL,
            headers: appConfigs.tracking.headers || {},
        });
    }

    async signIn(sessionData) {
        try {
            const response = await userGameSessionControllerSignIn({
                body: sessionData,
            });

            return response.data;
        } catch (error) {
            console.error("Failed to track user game session:", error);
        }
    }

    async signOut({ sessionId, gameId }) {
        try {
            const response = await userGameSessionControllerSignOut({
                body: { sessionId, gameId },
            });

            return response.data;
        } catch (error) {
            console.error("Failed to track user game session:", error);
        }
    }
}
