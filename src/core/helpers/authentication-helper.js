import Axios from "axios";
import OpenIdClient from "openid-client";
import { logger } from "sc-common";

const { Issuer, custom } = OpenIdClient;
const beforeTokenExpired = 60 * 5;
const timeout = 60000;

custom.setHttpOptionsDefaults({ timeout });

export class BearerAuthenticator {
    constructor(authConfigs) {
        this.authConfigs = authConfigs;
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

let authenticationConfigs;
let bearerAuthenticator;

export const init = async (configs) => {
    authenticationConfigs = configs;
    bearerAuthenticator = new BearerAuthenticator(configs.auth);

    await bearerAuthenticator.autoUpdateToken();
};

export const post = async (endpoint, params, options) => {
    if (!bearerAuthenticator) {
        logger.logError("authentication-helper has not been initialized properly.");
    }

    const defaultRequestTimeout = 2500;
    const { url, useAuthenticate, requestTimeout } = authenticationConfigs;
    const requestConfigs = {
        timeout: options?.requestTimeout || requestTimeout || defaultRequestTimeout,
        headers: {},
    };

    if (params?.languageCode) {
        requestConfigs.headers.LanguageCode = params.languageCode;
        delete params.languageCode;
    }

    if (useAuthenticate) {
        requestConfigs.headers.Authorization = bearerAuthenticator.token;
    }

    return (await Axios.post(`${url}/${endpoint}`, params, requestConfigs)).data;
};
