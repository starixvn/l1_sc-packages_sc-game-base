import authenticationHelpers from "./authentication-helpers";

const actions = {
    signInGame: "/gameBackend/signInGame",
};

export const signInGame = async (userServiceUrl, params) => {
    return authenticationHelpers.post(`${userServiceUrl}${actions.signInGame}`, params);
};
