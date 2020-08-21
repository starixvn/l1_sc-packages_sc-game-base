import { userInfos, users, userSessions } from "sc-base-database";

import UserSignInPublisher from "./../event-publishers/user-signin-publisher";

export default class UserRecheckinConsumer {
    /**
     * @param {UserSignInPublisher} userSigninPublisher
     */
    constructor(gameData, userSigninPublisher = null) {
        this.gameData = gameData;
        this.userSigninPublisher = userSigninPublisher ?? new UserSignInPublisher();
    }

    async consume(socketClient, payload) {
        if (!payload) {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);

            return;
        }

        if (this.gameData.realPlayers[socketClient.id]) {
            this.userSigninPublisher.publishRecheckInSuccessMesasge(socketClient);
        } else {
            const user = await users.findOne({ "local.username": payload.username }).lean().exec();
            const userInfo = await userInfos.findOne({ id: user._id.toString() }).lean().exec();
            const userSession = await userSessions.findOne({ sessionId: payload.ss }).lean().exec();

            if (
                userSession &&
                userSession.username === payload.username &&
                userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
            ) {
                userSession.characterName = userInfo.name;

                const userData = {
                    UID: user._id.toString(),
                    profile: { name: userInfo.name },
                    session: userSession,
                    socketClient,
                };

                // Store new user data
                this.gameData.realPlayers[socketClient.id] = userData;
            } else {
                this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
            }
        }
    }
}
