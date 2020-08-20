import { userInfos, users, userSessions } from "sc-base-database";
import UserSignInPublisher from "../event-publishers/user-signin-publisher";

export default class UserSignInConsumer {
    /**
     * @param {UserSignInPublisher} userSigninPublisher
     */
    constructor(userSigninPublisher = null) {
        this.userSigninPublisher = userSigninPublisher ?? new UserSignInPublisher();
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, gameData, payload) {
        if (!payload) {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);

            return;
        }

        const user = await users.findOne({ "local.username": payload.username });
        const userInfo = await userInfos.findOne({ id: user._id.toString() });
        const userSession = await userSessions.findOne({ sessionId: payload.ss });

        if (
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
        ) {
            this.handleSignInSuccess(socketClient, gameData, user, userInfo, userSession);
        } else {
            this.userSigninPublisher.publishUnauthorizedMessage(socketClient);
        }
    }

    handleSignInSuccess(socketClient, gameData, user, userInfo, userSession) {
        const session = userSession;
        const userData = {
            UID: user._id.toString(),
            profile: { name: userInfo.name },
            session,
            socketClient,
        };

        session.characterName = userInfo.name;

        // Clean up old user data
        Object.values(gameData.realPlayers).forEach((player) => {
            if (player.UID === userData.UID && player.socketClient) {
                player.socketClient.disconnect(true);
                delete gameData.realPlayers[player.socketClient.id];
            }
        });

        // Store new user data
        gameData.realPlayers[socketClient.id] = userData;
    }
}
