import BaseEventPublisher from "./base-event-publisher";

export default class GameStatusPublisher extends BaseEventPublisher {
    publishDisableGameStatus() {
        const disabledMessage = this.gameData.umMessages ?? {};
        const payload = { um: true, um_message: disabledMessage };

        this.publishToAllUsers(payload);
        this.publishToAllAdmins(payload);
    }

    publishEnablingGameStatus() {
        const { gameConfigs, remainingTime, roundId } = this.gameData;
        const configs = {
            odds: gameConfigs.odds,
            enableFreeBet: gameConfigs.enableFreeBet,
        };

        const realPlayers = Object.values(this.gameData.realPlayers);
        realPlayers.forEach((realPlayer) => {
            const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === realPlayer.session.currencyGroupId);
            const payload = { gameConfigs: { ...configs, ...settings }, remainingTime };
            realPlayer.socketClient && realPlayer.socketClient.emit(this.gameName, payload);
        });

        this.publishToAllAdmins({
            remainingTime,
            roundId,
            currencies: this.gameData.currencies,
            exchangeRates: this.gameData.exchangeRates,
        });
    }

    publishStartGame() {
        this.publishToAllUsers({
            remainingTime: this.gameData.remainingTime,
        });
        this.publishToAllAdmins({
            currencies: this.gameData.currencies,
            exchangeRates: this.gameData.exchangeRates,
        });
    }

    publishBoostedOdds() {
        if (this.gameData.gameConfigs) {
            this.publishToAllUsers({
                odds: { values: this.gameData.gameConfigs.odds, boostedChoices: this.gameData.gameConfigs.boostedChoices },
            });
        }
    }
}
