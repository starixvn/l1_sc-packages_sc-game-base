import Axios from "axios";
import { logger } from "sc-common";

import BearerAuthenticator from "./bearer-authenticator";

let authenticationConfigs;
let bearerAuthenticator;

const init = async (configs) => {
    authenticationConfigs = configs;
    bearerAuthenticator = new BearerAuthenticator(configs.auth);

    await bearerAuthenticator.autoUpdateToken();
};

const post = async (endpoint, params, options) => {
    if (!bearerAuthenticator) {
        logger.logError("authentication-helper has not been initialized properly.");

        return {};
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

export default {
    init,
    post,
};
