import { logger, utils } from "sc-common";
import mongoose from "mongoose";
import GameData from "./../game-data";
import { HistoryQuery } from "../query-apis";

export default class HttpRouter {
    /**
     * @param {Object} appConfigs
     * @param {GameData} gameData]
     * @param {HistoryQuery}
     * @param {mongoose.Model} userSessionsRepository
     */
    constructor(appConfigs, gameData, historyQuery, userSessionsRepository) {
        this.appConfigs = appConfigs;
        this.gameData = gameData;
        this.historyQuery = historyQuery;
        this.userSessionsRepository = userSessionsRepository;
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

        app.post(
            "/api/history",
            (_req, res, next) => this.verifySession(_req, res, next),
            (_req, res) => this.handleHistoryRequest(_req, res)
        );
    }

    async verifySession(req, res, next) {
        const { session, username } = req.body;
        const userAgent = req.headers["user-agent"];
        const userSession = await this.userSessionsRepository.findOne({ sessionId: session }).lean().exec();

        if (userSession && userSession.username === username && userSession.browserUserAgent.toUpperCase() === userAgent.toUpperCase()) {
            next();
        } else {
            res.sendStatus(401);
        }
    }

    async handleHistoryRequest(req, res) {
        try {
            const { session, page, pageSize } = req.body;

            const userSession = await this.userSessionsRepository.findOne({ sessionId: session }).lean().exec();
            const result = await this.historyQuery.queryHistory({ UID: userSession.userId }, +page, +pageSize);

            res.send(result);
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
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
                    system: player.session.system,
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
