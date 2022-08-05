import Axios from "axios";
import { logger } from "sc-common";

let chatBotConfigs;

const init = async (configs) => {
    chatBotConfigs = configs;
};

const post = async (message, options) => {
    if (!chatBotConfigs) {
        logger.logError("chat-bot-helper has not been initialized properly.");
    }

    try {
        const defaultRequestTimeout = 5000;
        const { url, token, conversationId, requestTimeout } = chatBotConfigs;
        const requestConfigs = {
            timeout: options?.requestTimeout || requestTimeout || defaultRequestTimeout,
            headers: {},
        };

        await Axios.post(`${url}forwardwithtoken?token=${token}&conversationId=${conversationId}&message=${message}`, {}, requestConfigs);
    } catch (e) {
        logger.logError(e);
    }
};

export default { init, post };
