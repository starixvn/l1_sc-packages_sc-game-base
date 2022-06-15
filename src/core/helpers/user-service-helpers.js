import Axios from "axios";
import authenticationHelpers from "./authentication-helpers";

const actions = {
    verifySession: "/auth/session/verify",
    signInGame: "/users/signInGame",
};

export const verifySession = async (userServiceSettings, params) => {
    const url = `${userServiceSettings.url}${actions.verifySession}`;
    const requestConfigs = { timeout: userServiceSettings.requestTimeout };

    return (await Axios.post(url, params, requestConfigs)).data;
};

export const signInGame = async (userServiceUrl, params) => {
    return authenticationHelpers.post(`${userServiceUrl}${actions.signInGame}`, params);
};
