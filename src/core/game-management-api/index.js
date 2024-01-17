import { logger } from "sc-common";
import { gameManagementClient } from "sc-game-management-client";
import { CustomAxiosRequest } from "sc-game-management-client/lib/CustomAxiosRequest";
import { authenticationHelpers } from "../helpers";

export const getOrDefault = async (requestPromise, defaultValue) => {
    try {
        const response = await requestPromise;

        if (response.isSuccessful) {
            return response.data;
        }
    } catch (e) {
        console.log("getOrDefault error", new Date(), e.message);
        logger.logError(e);
    }

    return defaultValue;
};

export const post = async (requestPromise) => {
    try {
        const response = await requestPromise;

        if (response.isSuccessful) {
            return response.data;
        }
    } catch (e) {
        console.log("post error", new Date(), e.message);
        logger.logError(e);
    }

    return null;
};

export const callAndForget = (requestPromise) => {
    requestPromise.catch((e) => {
        console.log("callAndForget error", new Date(), e.message);
        logger.logError(e);
    });
};

export default class GameManagementApiClientFactory {
    constructor(appConfigs) {
        this.gameManagementApiSettings = appConfigs.gameManagementApiSettings;
        this.apiClient = new gameManagementClient(
            {
                ...this.gameManagementApiSettings,
                TOKEN: authenticationHelpers.getBearerToken,
            },
            CustomAxiosRequest
        );
    }

    instance() {
        return this.apiClient;
    }
}
