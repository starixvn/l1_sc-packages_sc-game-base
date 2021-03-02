import OpenIdClient from "openid-client";
import { logger } from "sc-common";

const { Issuer, custom } = OpenIdClient;
const beforeTokenExpired = 60 * 5;
const timeout = 60000;

custom.setHttpOptionsDefaults({ timeout });

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
            const token = await this.getBearerToken();

            this.token = token.token;
            this.expired = token.expired;

            logger.log("Get bearer token successfully.");
        } catch (error) {
            logger.logError(`Get bearer token failed: ${error}`);
        }
    }

    async getBearerToken() {
        const clientMetadata = {
            grant_type: "client_credentials",
            client_id: this.authConfigs.id,
            client_secret: this.authConfigs.secret,
        };
        const issuer = await Issuer.discover(this.authConfigs.url);
        const client = new issuer.Client(clientMetadata);
        const token = await client.grant(clientMetadata);

        return token.access_token
            ? {
                  token: `${token.token_type} ${token.access_token}`,
                  expired: token.expires_at,
              }
            : null;
    }
}
