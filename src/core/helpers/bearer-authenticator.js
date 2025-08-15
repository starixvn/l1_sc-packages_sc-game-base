import { Issuer } from "openid-client";
import { logger } from "sc-common";
const beforeTokenExpired = 60 * 5;
const timeout = 60000;

export default class BearerAuthenticator {
    constructor(authConfigs) {
        this.authConfigs = authConfigs;
    }

    async autoUpdateToken() {
        await this.updateToken();
        setTimeout(this.refresh.bind(this), timeout);
    }

    async refresh() {
        if (this.isTokenExpired()) {
            await this.updateToken();
        }

        setTimeout(this.refresh.bind(this), timeout);
    }

    isTokenExpired() {
        return !this.expired || this.expired - Date.now() / 1000 - beforeTokenExpired <= 0;
    }

    async updateToken() {
        try {
            const result = await this.getBearerToken();

            if (result) {
                this.token = result.token;
                this.expired = result.expired;
                logger.log("Get bearer token successfully.");
            } else {
                logger.logError("No access token received");
            }
        } catch (error) {
            logger.logError(`Get bearer token failed: ${error.message}`);
        }
    }

    async getBearerToken() {
        const clientMetadata = {
            grant_type: "client_credentials",
            client_id: this.authConfigs.id,
            client_secret: this.authConfigs.secret,
        };

        try {
            const issuer = await Promise.race([
                Issuer.discover(this.authConfigs.url),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Issuer discovery timeout")), timeout)),
            ]);

            const client = new issuer.Client(clientMetadata);
            const token = await Promise.race([
                client.grant(clientMetadata),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Token grant timeout")), timeout)),
            ]);

            return token.access_token
                ? {
                      token,
                      expired: token.expires_at,
                  }
                : null;
        } catch (error) {
            logger.logError(`Bearer token request failed: ${error.message}`);
            throw error;
        }
    }

    hasValidToken() {
        return this.token && !this.isTokenExpired();
    }

    formatToken() {
        if (!this.hasValidToken()) {
            logger.logWarning("No valid bearer token available");
            return "";
        }
        return `${this.token.token_type} ${this.token.access_token}`;
    }
}
