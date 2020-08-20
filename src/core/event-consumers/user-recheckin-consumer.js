import { userInfos, users, userSessions } from "sc-base-database";
import { logger } from "sc-common";
import UserSignInPublisher from "../event-publishers/user-signin-publisher";

export default class UserRecheckinConsumer {
    /**
     * @param {UserSignInPublisher} userSigninPublisher
     */
    constructor(userSigninPublisher = null) {
        this.userSigninPublisher = userSigninPublisher ?? new UserSignInPublisher();
    }

    async consume(socketClient, storage, payload) {
        if (!payload) {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
            return;
        }

        if (storage.loggedUsers[socketClient.id]) {
            this.userSigninPublisher.publishRecheckInSuccessMesasge(socketClient);
        } else {
            try {
                const user = await users.findOne({ "local.username": payload.username });
                const userInfo = await userInfos.findOne({ id: user._id.toString() });
                const userSession = await userSessions.findOne({ sessionId: payload.ss });

                if (
                    userSession &&
                    userSession.username === payload.username &&
                    userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
                ) {
                    let session = userSession;
                    session.characterName = userInfo.name;

                    const userData = {
                        UID: user._id.toString(),
                        profile: { name: userInfo.name },
                        session: session,
                        socketClient,
                    };

                    // Store new user data
                    storage.loggedUsers[socketClient.id] = { ...userData };
                } else {
                    this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
                }
            } catch (error) {
                logger.logError(error);
            }
        }
    }
}
