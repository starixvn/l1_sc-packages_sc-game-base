import _ from 'lodash';
import { userInfos, users, userSessions } from 'sc-base-database';
import { logger } from 'sc-common';
import GameTypes from '../constants/game-types.js';

export default class BaseUserSignInConsumer {
    constructor(gameType, gameName) {
        this.gameType = gameType;
        this.gameName = gameName;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, storage, payload) {
        if (!payload) {
            this.publishUnauthorizedMessage(socketClient);
            return;
        }

        try {
            const user = await users.findOne({ 'local.username': payload.username });
            const userInfo = await userInfos.findOne({ id: user._id.toString() });
            const userSession = await userSessions.findOne({ sessionId: payload.ss });

            if (
                userSession &&
                userSession.username === payload.username &&
                userSession.browserUserAgent.toUpperCase() === socketClient.request.headers['user-agent'].toUpperCase()
            ) {
                let session = userSession;
                session.characterName = userInfo.name;

                const userData = {
                    UID: user._id.toString(),
                    profile: { name: userInfo.name },
                    session: session,
                    socketClient
                };

                // Clean up old user data
                _.values(storage.loggedUsers).forEach((loggedUser) => {
                    if (loggedUser.UID === userData.UID && loggedUser.socketClient && !loggedUser.socketClient.connected) {
                        delete storage.loggedUsers[loggedUser.socketClient.id];
                    }
                });

                // Store new user data
                storage.loggedUsers[socketClient.id] = { ...userData };

                if (this.gameType === GameTypes.RoomGame) {
                    socketClient.emit('message', { toGame: this.gameName });
                }
            } else {
                this.publishUnauthorizedMessage(socketClient);
            }
        } catch (error) {
            logger.logError(error);
        }
    }

    publishUnauthorizedMessage(socketClient) {
        socketClient.emit('message', { unauthorized: true });
    }
}
