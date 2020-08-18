import { userInfos, users, userSessions } from "sc-base-database";
import GameDefinition from "../game-definition.js";

export default class BaseUserSignInConsumer {
    /**
     * @param {GameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(gameData, socketClient, payload) {
        if (!payload) {
            this.publishUnauthorizedMessage(socketClient);

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
            this.handleSignInSuccess(gameData, userSession, userInfo);
        } else {
            this.publishUnauthorizedMessage(socketClient);
        }
    }

    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }

    handleSignInSuccess(gameData, socketClient, userSession, userInfo) {
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
    }
}
