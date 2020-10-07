import Axios from "axios";

import AuthenticationHelper from "../helpers/authentication-helper";
import BaseEventPublisher from "./base-event-publisher";

export default class UserBetResultPublisher extends BaseEventPublisher {
    constructor(gameName, gameData, mainServerApiSettings) {
        super(gameName, gameData);
        this.mainServerApiSettings = mainServerApiSettings;
        this.authenticationHelper = new AuthenticationHelper(mainServerApiSettings.auth);
        this.authenticationHelper.autoUpdateToken();
    }

    async publish(userId, betResult) {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        await this.publishToUser(userId, { status });
    }

    async publishToUser(userId, payload, path = this.gameName) {
        const realPlayer = Object.values(this.gameData.realPlayers).find(
            (player) => player.UID === userId && player.socketClient && player.socketClient.connected
        );

        if (realPlayer && realPlayer.socketClient) {
            realPlayer.socketClient.emit(path, payload);
        } else {
            this.refreshBalance(userId);
        }
    }

    async refreshBalance(userId) {
        const { url, useAuthenticate, requestTimeout } = this.mainServerApiSettings;
        const defaultTimeout = 2500;
        const requestConfigs = {
            timeout: requestTimeout || defaultTimeout,
            headers: {},
        };
        if (useAuthenticate) {
            requestConfigs.headers.Authorization = this.authenticationHelper.token;
        }

        await Axios.post(`${url}/refreshBalance`, { uid: userId }, requestConfigs);
    }
}
