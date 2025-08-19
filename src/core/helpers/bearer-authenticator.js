import { discovery, clientCredentialsGrant } from "openid-client";
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
        try {
            const config = await discovery(new URL(this.authConfigs.url), this.authConfigs.id, this.authConfigs.secret, {
                insecure: true,
                timeout: timeout / 1000,
            });

            const token = await clientCredentialsGrant(config);

            return token.access_token
                ? {
                      token,
                      expired: token.expiresIn ? Math.floor(Date.now() / 1000) + token.expiresIn() : null,
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
