import { logger, utils } from "sc-common";

import GameData from "./../game-data";

export default class HttpRouter {
    /**
     * @param {Object} appConfigs
     * @param {GameData} gameData
     */
    constructor(appConfigs, gameData) {
        this.appConfigs = appConfigs;
        this.gameData = gameData;
    }

    init(app) {
        app.get(
            "/api/onlineusers",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleOnlineUsers(res)
        );
    }

    handleOnlineUsers(res) {
        try {
            const onlineUsers = this.collectOnlineUsers();

            res.send(onlineUsers);
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
    }

    collectOnlineUsers() {
        const users = this.mapRealUsers(Object.values(this.gameData.realPlayers));

        return {
            totalRealPlayer: users.realUsers.length,
            realUsers: users.realUsers,
            totalUusPlayer: users.uusUsers.length,
            uusUsers: users.uusUsers,
        };
    }

    mapRealUsers(players) {
        const uusUsers = [];
        const realUsers = [];

        players.forEach((player) => {
            if (player && player.session && player.socketClient && player.socketClient.connected) {
                const user = {
                    name: player.session.memberName,
                    id: player.session.memberId,
                    currency: player.session.currency,
                    character: player.session.characterName,
                };

                if (player.session.currency && player.session.currency.toUpperCase() === "UUS") {
                    uusUsers.push(user);
                } else {
                    realUsers.push(user);
                }
            }
        });

        return { uusUsers, realUsers };
    }
}
