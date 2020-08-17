import { userInfos, users, userSessions } from "sc-base-database";
import { logger } from "sc-common";
import { GameTypes } from "./../../constants";

export default class BaseUserSignInConsumer {
    constructor(gameType, gameName) {
        this.gameType = gameType;
        this.gameName = gameName;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, gameData, payload) {
        if (!payload) {
            this.publishUnauthorizedMessage(socketClient);

            return;
        }

        try {
            const user = await users.findOne({ "local.username": payload.username });
            const userInfo = await userInfos.findOne({ id: user._id.toString() });
            const userSession = await userSessions.findOne({ sessionId: payload.ss });

            if (
                userSession &&
                userSession.username === payload.username &&
                userSession.browserUserAgent.toUpperCase() === socketClient.request.headers["user-agent"].toUpperCase()
            ) {
                const session = userSession;
                const userData = {
                    UID: user._id.toString(),
                    profile: { name: userInfo.name },
                    session: session,
                    socketClient,
                };

                session.characterName = userInfo.name;

                // Clean up old user data
                Object.values(gameData.realPlayers).forEach((player) => {
                    if (player.UID === userData.UID && player.socketClient && !player.socketClient.connected) {
                        delete gameData.realPlayers[player.socketClient.id];
                    }
                });

                // Store new user data
                gameData.realPlayers[socketClient.id] = { ...userData };

                if (this.gameType === GameTypes.RoomGame) {
                    socketClient.emit("message", { toGame: this.gameName });
                }
            } else {
                this.publishUnauthorizedMessage(socketClient);
            }
        } catch (error) {
            logger.logError(error);
        }
    }

    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }
}
