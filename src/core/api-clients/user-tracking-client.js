import { createClient } from "@sc/user-tracking-client";
import { userGameSessionControllerInsertUserGameSession } from "@sc/user-tracking-client";

export default class UserTrackingClient {
    constructor(config) {
        this.client = createClient({
            baseURL: config.baseURL,
            headers: config.headers || {},
        });
    }

    async createSession(sessionData) {
        try {
            const response = await userGameSessionControllerInsertUserGameSession({
                client: this.client,
                data: sessionData,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to create user game session:", error);
            throw error;
        }
    }
}
