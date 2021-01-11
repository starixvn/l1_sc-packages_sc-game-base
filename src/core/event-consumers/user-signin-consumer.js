import mongoose from "mongoose";

import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSigninPublisher
     * @param {mongoose.Model} userInfos
     * @param {mongoose.Model} userSessions
     */
    constructor(gameData, userSigninPublisher, userInfos, userSessions) {
        this.gameData = gameData;
        this.userSigninPublisher = userSigninPublisher;
        this.userInfos = userInfos;
        this.userSessions = userSessions;
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

        const userSession = await this.userSessions.findOne({ sessionId: payload.ss }).lean().exec();
        const userInfo = await this.userInfos.findOne({ id: userSession.userId }).lean().exec();

        if (
            userInfo &&
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
        ) {
            Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                    realPlayer.socketClient.disconnect(true);
                    delete this.gameData.realPlayers[realPlayer.socketClient.id];
                }
            });

            this.handleSignInSuccess(socketClient, userInfo, userSession);
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

        socketClient.emit("signedIn");
    }
}
