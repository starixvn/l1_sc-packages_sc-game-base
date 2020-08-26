import { logger, utils } from "sc-common";

import TableGameData from "../table-game-data";

export default class HttpRouter {
    /**
     * @param {TableGameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    init(app) {
        app.get(
            "/api/onlineusers",
            utils.authentication.useAuthenticate({
                authUrl: appConfigs.apiSettings.authUrl,
                audiences: appConfigs.authenticateSettings.audiences,
            }),
            (req, res) => this.handleOnlineUsers(res)
        );
    }

    async handleOnlineUsers(res) {
        try {
            const users = this.mapRealUsers(Object.values(this.gameData.realPlayers));

            let bots = Object.values(this.gameData.players)
                .filter((player) => player.type)
                .map((bot) => ({ name: bot.name, red: bot.red }));

            res.send({
                totalRealPlayer: users.realUsers.length,
                realUsers: users.realUsers,
                totalUusPlayer: users.uusUsers.length,
                uusUsers: users.uusUsers,
                totalBots: bots.length,
                bots: bots,
            });

            return;
        } catch (err) {
            logger.logError(err);
        }

        res.send({ error: true });
    }

    mapRealUsers(players) {
        let uusUsers = [];
        let realUsers = [];

        players.forEach(function (player) {
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

        return { uusUsers: uusUsers, realUsers: realUsers };
    }
}
