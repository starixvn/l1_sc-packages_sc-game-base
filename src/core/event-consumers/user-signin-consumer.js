import mongoose from "mongoose";
import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";

export default class UserSignInConsumer {
    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} userSessionsRepository
     * @param {PlayGamePermissionValidator} playGamePermissionValidator
     */
    constructor(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository, playGamePermissionValidator) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.userInfosRepository = userInfosRepository;
        this.userSessionsRepository = userSessionsRepository;
        this.playGamePermissionValidator = playGamePermissionValidator;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        const userAgent = socketClient.request.headers["user-agent"];

        if (!payload || !userAgent) {
            this.handleUnauthorizedSignIn(socketClient);
            return false;
        }

        const userSession = await this.userSessionsRepository.findOne({ sessionId: payload.ss }).lean().exec();
        const userInfo = userSession ? await this.userInfosRepository.findOne({ id: userSession.userId }).lean().exec() : null;

        if (
            userInfo &&
            userSession &&
            userSession.username === payload.username &&
            userSession.browserUserAgent.toUpperCase() === userAgent.toUpperCase()
        ) {
            await this.getUserBetLimit(userSession, userInfo, socketClient);

            if (this.playGamePermissionValidator.validate(userSession, socketClient)) {
                Object.values(this.gameData.realPlayers).forEach((realPlayer) => {
                    if (realPlayer.UID === userSession.userId && realPlayer.socketClient) {
                        realPlayer.socketClient.disconnect(true);
                        delete this.gameData.realPlayers[realPlayer.socketClient.id];
                    }
                });
            }

            this.handleSignInSuccess(socketClient, userInfo, userSession);
            return true;
        }

        this.handleUnauthorizedSignIn(socketClient);
        return false;
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
