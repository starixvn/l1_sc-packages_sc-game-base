import Axios from "axios";

const actions = {
    verifySession: "/auth/session/verify",
};

export const verifySession = async (userServiceSettings, params) => {
    const url = `${userServiceSettings.url}${actions.verifySession}`;
    const requestConfigs = { timeout: userServiceSettings.requestTimeout };

    return (await Axios.post(url, params, requestConfigs)).data;
};
