import { userInfos, users, userSessions } from "sc-base-database";

import UserSignInPublisher from "./../event-publishers/user-signin-publisher";

export default class UserSignInConsumer {
    /**
     * @param {UserSignInPublisher} userSigninPublisher
     */
    constructor(gameData, userSigninPublisher = null) {
        this.gameData = gameData;
        this.userSigninPublisher = userSigninPublisher ?? new UserSignInPublisher();
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (!payload) {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);

            return;
        }

        const user = await users.findOne({ "local.username": payload.username }).lean().exec();
        const userInfo = await userInfos.findOne({ id: user._id.toString() }).lean().exec();
        const userSession = await userSessions.findOne({ sessionId: payload.ss }).lean().exec();

        if (
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
        ) {
            this.handleSignInSuccess(socketClient, user, userInfo, userSession);
        } else {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
        }
    }

    handleSignInSuccess(socketClient, user, userInfo, userSession) {
        const userData = {
            UID: user._id.toString(),
            profile: { name: userInfo.name },
            session: userSession,
            socketClient,
        };

        userSession.characterName = userInfo.name;

        // Clean up old user data
        Object.values(this.gameData.realPlayers).forEach((player) => {
            if (player.UID === userData.UID && player.socketClient) {
                player.socketClient.disconnect(true);
                delete this.gameData.realPlayers[player.socketClient.id];
            }
        });

        // Store new user data
        this.gameData.realPlayers[socketClient.id] = userData;
    }
}
