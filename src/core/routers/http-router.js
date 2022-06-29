import { logger, utils } from "sc-common";
import { HistoryQuery, MetricQuery } from "../query-apis";
import GameData from "./../game-data";
import { signInGame as userServiceSignInGame } from "../helpers/user-service-helpers";

export default class HttpRouter {
    /**
     * @param {Object} appConfigs
     * @param {GameData} gameData
     * @param {HistoryQuery} historyQuery
     * @param {MetricQuery} metricQuery
     * @param {logger} dependencies.logService
     */
    constructor(appConfigs, gameData, historyQuery, metricQuery, logService) {
        this.appConfigs = appConfigs;
        this.gameData = gameData;
        this.historyQuery = historyQuery;
        this.metricQuery = metricQuery;
        this.logService = logService;
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

        app.post("/api/history", (_req, res) => this.verifySession(_req, res, this.handleHistoryRequest.bind(this)));

        app.get("/api/metrics", (_req, res) => this.handleMetrics(_req, res));
    }

    async verifySession(req, res, callback) {
        const { session, username } = req.body;
        const params = { session, username, browserUserAgent: req.headers["user-agent"] };
        const signInGameResult = await userServiceSignInGame(this.appConfigs.userServiceSettings.url, params);

        if (signInGameResult.statusCode) {
            res.sendStatus(401);
        } else {
            callback && callback(req, res, signInGameResult.session);
        }
    }

    async handleHistoryRequest(req, res, userSession) {
        try {
            const { page, pageSize } = req.body;
            const result = await this.historyQuery.queryHistory({ UID: userSession.userId }, +page, +pageSize);
            res.send(result);
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }

    handleOnlineUsers(res) {
        try {
            const onlineUsers = this.collectOnlineUsers();

            res.send(onlineUsers);
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }

    collectOnlineUsers() {
        const users = this.mapRealUsers(Object.values(this.gameData.realPlayers));

        return {
            totalRealPlayer: users.realUsers.length,
            realUsers: users.realUsers,
            totalTestPlayer: users.testUsers.length,
            testUsers: users.testUsers,
        };
    }

    mapRealUsers(players) {
        const testUsers = [];
        const realUsers = [];

        players.forEach((player) => {
            if (player && player.session && player.socketClient && player.socketClient.connected) {
                const user = {
                    name: player.session.memberName,
                    id: player.session.memberId,
                    currency: player.session.currencyName,
                    character: player.session.characterName,
                    system: player.session.system,
                    partnerId: player.session.partnerId,
                    operatorId: player.session.partnerId,
                };

                if (player.session.isTestCurrency) {
                    testUsers.push(user);
                } else {
                    realUsers.push(user);
                }
            }
        });

        return { testUsers, realUsers };
    }

    handleMetrics(req, res) {
        try {
            const { secretKey } = req?.query || {};

            if (secretKey) {
                res.send(this.metricQuery.getMetrics(secretKey));

                return;
            }

            res.send({ error: true });
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }
}
