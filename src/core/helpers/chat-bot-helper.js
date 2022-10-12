import Axios from "axios";
import { logger } from "sc-common";

let chatBotConfigs;

const channels = {
    boostedOdds: "boostedOdds",
};

const init = async (configs) => {
    chatBotConfigs = configs;
};

const post = async (channel, message, options) => {
    if (!chatBotConfigs) {
        logger.logError("chat-bot-helper has not been initialized properly.");
    }

    try {
        const defaultRequestTimeout = 5000;
        const { url, token, conversationIds, requestTimeout } = chatBotConfigs;
        const requestConfigs = {
            timeout: options?.requestTimeout || requestTimeout || defaultRequestTimeout,
            headers: {},
        };

        await Axios.post(
            `${url}forwardwithtoken?token=${token}&conversationId=${conversationIds[channel]}&message=${message}`,
            {},
            requestConfigs
        );
    } catch (e) {
        logger.logError(e);
    }
};

const sendBoostedOddsMessage = async (message) => {
    await post(channels.boostedOdds, message);
};

export default { init, post, sendBoostedOddsMessage };
