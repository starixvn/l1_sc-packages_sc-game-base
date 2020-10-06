import OpenIdClient from "openid-client";

const beforeTokenExpired = 60 * 5;
const timeout = 60000;
const { Issuer, custom } = OpenIdClient;

custom.setHttpOptionsDefaults({ timeout });

export default class AuthenticationHelper {
    constructor(identitySettings) {
        this.identitySettings = identitySettings;
    }

    async autoUpdateToken() {
        const refresh = async () => {
            if (this.isTokenExpired()) {
                await this.updateToken();
            }

            setTimeout(refresh, timeout);
        };

        await this.updateToken();
        setTimeout(refresh, timeout);
    }

    isTokenExpired() {
        return !this.expired || this.expired - Date.now() / 1000 - beforeTokenExpired <= 0;
    }

    async updateToken() {
        try {
            const token = await this.getBearerToken();

            this.token = token.token;
            this.expired = token.expired;

            this.logger.log("Get bearer token successfully.");
        } catch (error) {
            this.logger.logError(`Get bearer token failed: ${error}`);
        }
    }

    async getBearerToken() {
        const clientMetadata = {
            grant_type: "client_credentials",
            client_id: this.identitySettings.id,
            client_secret: this.identitySettings.secret,
        };
        const issuer = await Issuer.discover(this.identitySettings.url);
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
