import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import GameManagementApiClientFactory, { getOrDefault, callAndForget } from "../game-management-api";
import { signInGame as userServiceSignInGame } from "../helpers/user-service-helpers";
import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";
import UserTrackingClient from "../communicators/user-tracking-client";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {PlayGamePermissionValidator} playGamePermissionValidator
     * @param {Object} appConfigs
     * @param {GameManagementApiClientFactory} gameManagementApiClientFactory
     * @param {UserTrackingClient} userTrackingClient
     */
    constructor(
        gameData,
        userSignInPublisher,
        playGamePermissionValidator,
        appConfigs,
        gameManagementApiClientFactory,
        userTrackingClient
    ) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.playGamePermissionValidator = playGamePermissionValidator;
        this.appConfigs = appConfigs;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
        this.userTrackingClient = userTrackingClient;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (!payload) {
            this.handleUnauthorizedSignIn(socketClient);

            return;
        }

        const params = {
            session: payload.ss,
            username: payload.username,
            browserUserAgent: socketClient.request.headers["user-agent"],
        };

        const signInGameResult = await userServiceSignInGame(this.appConfigs.userServiceSettings.url, params);

        const userSession = {
            ...signInGameResult,
            userId: signInGameResult.id,
            playerName: signInGameResult.memberName,
            browserUserAgent: socketClient.request.headers["user-agent"],
        };

        const userInfo = await getOrDefault(this.gameManagementApiClient.users.getUserInfo(userSession.userId));

        if (!userInfo) {
            this.handleUnauthorizedSignIn(socketClient);

            return;
        }

        if (this.playGamePermissionValidator.validate(userSession, socketClient)) {
            await this.getUserBetLimit(userSession, userInfo, socketClient);

            Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                    realPlayer.socketClient.disconnect(true);
                    delete this.gameData.realPlayers[realPlayer.socketClient.id];
                }
            });

            await this.handleSignInSuccess(socketClient, userInfo, userSession);
        }
    }

    async getUserBetLimit(userSession, userInfo, socketClient) {
        const apiResult = await getBetLimit({ session: userSession });

        if (apiResult.isOk) {
            const { response } = apiResult;
            if (response.minBet > 0 && response.maxBet > 0) {
                userInfo.minBet = response.minBet;
                userInfo.maxBet = response.maxBet;
                callAndForget(
                    this.gameManagementApiClient.users.updateUserStakeLevel({
                        id: userSession.userId,
                        minBet: response.minBet,
                        maxBet: response.maxBet,
                    })
                );
            }

            const userStakeLevel = { minBet: userInfo.minBet, maxBet: userInfo.maxBet };
            socketClient.emit("message", { userStakeLevel });
        }
    }

    async handleSignInSuccess(socketClient, userInfo, userSession) {
        const userData = {
            UID: userSession.userId,
            profile: { name: userInfo.name, minBet: userInfo.minBet, maxBet: userInfo.maxBet },
            session: userSession,
            socketClient,
        };

        userSession.characterName = userInfo.name;
        this.gameData.realPlayers[socketClient.id] = userData;

        const sessionData = {
            ...userSession,
            gameId: this.gameData.gameConfigs?.gameId ?? 0,
            gameConfigType: this.gameData.gameConfigs?.type ?? 0,
        };

        try {
            await this.userTrackingClient.signIn(sessionData);
        } catch (error) {
            console.error("Failed to track user game session:", error);
            console.log(sessionData);
        }

        socketClient.emit("signedIn");
    }

    handleUnauthorizedSignIn(socketClient) {
        this.userSignInPublisher.publishUnauthorizedMessage(socketClient);
        socketClient.disconnect(true);
    }
}
