import { getBetLimit } from "sc-base-apis";
import { Socket } from "socket.io";

import { PlayGamePermissionValidator } from "../validators";
import UserSignInPublisher from "./../event-publishers/user-signin-publisher";
import GameData from "./../game-data";
import { signInGame as userServiceSignInGame } from "../helpers/user-service-helpers";

export default class UserSignInConsumer {
    ForbiddenCode = 403;

    /**
     * @param {GameData} gameData
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {PlayGamePermissionValidator} playGamePermissionValidator
     * @param {Object} appConfigs
     * @param {logger} logService
     */
    constructor(gameData, userSignInPublisher, playGamePermissionValidator, appConfigs, userInfosRepository, logService) {
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
        this.playGamePermissionValidator = playGamePermissionValidator;
        this.appConfigs = appConfigs;
        this.userInfosRepository = userInfosRepository;
        this.logService = logService;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        try {
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

            if (signInGameResult.statusCode) {
                this.handleUnauthorizedSignIn(socketClient);
            } else {
                const userSession = {
                    ...signInGameResult,
                    userId: signInGameResult.id,
                    partnerId: signInGameResult.operatorId,
                    memberId: signInGameResult.playerId,
                };

                const userInfo = await this.userInfosRepository.findOne({ id: userSession.userId }).lean().exec();
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
            }
        } catch (e) {
            this.handleErrors(socketClient, payload, e);
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

    handleErrors(socketClient, payload, e) {
        this.handleUnauthorizedSignIn(socketClient);

        const waringCodes = [this.ForbiddenCode];
        const message = `Error when signin: ${JSON.stringify(payload)}. ${e}`;
        const isWarning = e.response?.status && waringCodes.indexOf(e.response.status) !== -1;
        if (isWarning) {
            this.logService.logWarning(message);
        } else {
            this.logService.logError(message);
        }
    }
}
