import mongoose from "mongoose";
import { notifyLogin } from "sc-base-apis";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} userSessionsRepository
     */
    constructor(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.userInfosRepository = userInfosRepository;
        this.userSessionsRepository = userSessionsRepository;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (!payload) {
            this.handleUnauthorizedSignIn(socketClient);

            return;
        }

        const userSession = await this.userSessionsRepository.findOne({ sessionId: payload.ss }).lean().exec();
        const userInfo = userSession ? await this.userInfosRepository.findOne({ id: userSession.userId }).lean().exec() : null;

        if (
            userInfo &&
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
        ) {
            await this.enterPortal(userSession, userInfo);

            Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                    realPlayer.socketClient.disconnect(true);
                    delete this.gameData.realPlayers[realPlayer.socketClient.id];
                }
            });

            this.handleSignInSuccess(socketClient, userInfo, userSession);
        } else {
            this.handleUnauthorizedSignIn(socketClient);
        }
    }

    async enterPortal(userSession, userInfo) {
        const apiResult = await notifyLogin({ session: userSession }, userInfo.name, false);

        if (apiResult.isOk) {
            const { response } = apiResult;

            userInfo.minBet = response.minBet;
            userInfo.maxBet = response.maxBet;
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
