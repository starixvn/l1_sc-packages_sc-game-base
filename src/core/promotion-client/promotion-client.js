import { GamePromotionApiClient } from "@sc/game-promotion-api-client";
import { logger } from "sc-common";

export default class PromotionClient {
    constructor({ appConfigs }) {
        this.promotionApiSettings = appConfigs.promotionApiSettings;

        // Only create the client if promotion settings are configured
        if (this.promotionApiSettings) {
            const { baseUrl, timeout = 5000, useAuthentication = true } = this.promotionApiSettings;

            if (!baseUrl) {
                throw new Error("baseUrl is required in promotionApiSettings");
            }

            // Prepare headers for authentication
            const headers = {
                "Content-Type": "application/json",
            };

            if (useAuthentication) {
                // You can add authentication logic here if needed
                // For example: headers.Authorization = `Bearer ${token}`;
            }

            // Create the official client
            this.apiClient = new GamePromotionApiClient({
                baseURL: baseUrl,
                timeout: timeout,
                headers: headers,
            });

            logger.log("GamePromotionApiClient initialized with settings:", { baseUrl, timeout, useAuthentication });
        } else {
            this.apiClient = null;
            logger.log("Promotion API settings not configured, GamePromotionApiClient not initialized");
        }
    }

    instance() {
        return this.apiClient;
    }

    /**
     * Check if the promotion API client is available
     * @returns {boolean}
     */
    isAvailable() {
        return this.apiClient !== null;
    }
}
