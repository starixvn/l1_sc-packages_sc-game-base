import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";
import Axios from "axios";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {PlayGamePermissionValidator} playGamePermissionValidator
     * @param {Object} appConfigs
     */
    constructor(gameData, userSignInPublisher, playGamePermissionValidator, appConfigs) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.playGamePermissionValidator = playGamePermissionValidator;
        this.appConfigs = appConfigs;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (!payload) {
            this.handleUnauthorizedSignIn(socketClient);

            return;
        }

        const url = `${this.appConfigs.userServiceSettings.url}/auth/session/verify`;
        const params = { session: payload.ss, username: payload.username, browserUserAgent: socketClient.request.headers["user-agent"] };
        const requestConfigs = { timeout: this.appConfigs.userServiceSettings.requestTimeout };
        const verifySessionResult = (await Axios.post(url, params, requestConfigs)).data;

        if (verifySessionResult.isSuccessful) {
            const { user: userInfo, userSession } = verifySessionResult;
            if (this.playGamePermissionValidator.validate(userSession, socketClient)) {
                await this.getUserBetLimit(userSession, userInfo, socketClient);

                Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                    if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                        realPlayer.socketClient.disconnect(true);
                        delete this.gameData.realPlayers[realPlayer.socketClient.id];
                    }
                });

                this.handleSignInSuccess(socketClient, userInfo, userSession);
            }
        } else {
            this.handleUnauthorizedSignIn(socketClient);
        }
    }

    async getUserBetLimit(userSession, userInfo, socketClient) {
        const apiResult = await getBetLimit({ session: userSession });

        if (apiResult.isOk) {
            const { response } = apiResult;
            if (response.minBet > 0 && response.maxBet > 0) {
                userInfo.minBet = response.minBet;
                userInfo.maxBet = response.maxBet;
            }

            const userStakeLevel = { minBet: userInfo.minBet, maxBet: userInfo.maxBet };
            socketClient.emit("message", { userStakeLevel });
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        const userData = {
            UID: userSession.userId,
            profile: { name: userInfo.name, minBet: userInfo.minBet, maxBet: userInfo.maxBet },
            session: userSession,
            socketClient,
        };

        userSession.characterName = userInfo.name;
        this.gameData.realPlayers[socketClient.id] = userData;

        socketClient.emit("signedIn");
    }

    handleUnauthorizedSignIn(socketClient) {
        this.userSignInPublisher.publishUnauthorizedMessage(socketClient);
        socketClient.disconnect(true);
    }
}
