import { userInfos, userSessions } from "sc-base-database";
import { logger } from "sc-common";

import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
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
            socketClient.disconnect(true);

            return;
        }

        const userSession = await userSessions.findOne({ sessionId: payload.ss }).lean().exec();
        const userInfo = await userInfos.findOne({ id: userSession.userId }).lean().exec();

        if (
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
        ) {
            this.handleSignInSuccess(socketClient, userInfo, userSession);

            logger.setTag({ id: "socket-io-id", value: socketClient.id });
            logger.setTag({ id: "username", value: payload.username });
            logger.log("Sign-in: Success");
            logger.setTag({ id: "socket-io-id", value: "" });
            logger.setTag({ id: "username", value: "" });
        } else {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
            socketClient.disconnect(true);
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        const userData = {
            UID: userSession.userId,
            profile: { name: userInfo.name },
            session: userSession,
            socketClient,
        };

        userSession.characterName = userInfo.name;
        this.gameData.realPlayers[socketClient.id] = userData;
    }
}
