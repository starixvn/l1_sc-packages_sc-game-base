import BaseEventPublisher from "./base-event-publisher";

export default class GameStatusPublisher extends BaseEventPublisher {
    publishDisableGameStatus(gameData) {
        const disabledMessage = gameData.gameConfigs.disabled_message ?? "";
        const payload = { um: true, um_message: disabledMessage };

        this.publishToAllUsers(payload);
        this.publishToAllAdmins(payload);
    }

    publishPreviousDisableGameStatus(gameData) {
        const gameConfigs = gameData.gameConfigs;
        const configs = {
            minbet: gameConfigs.minbet,
            maxbet: gameConfigs.maxbet,
            choices_maxbet: gameConfigs.choices_maxbet,
            odds: gameConfigs.odds,
            enableFreeBet: gameConfigs.enableFreeBet,
        };

        this.publishToAllUsers({ gameConfigs: configs, remainingTime: gameData.remainingTime });
        this.publishToAllAdmins({ remainingTime: gameData.remainingTime, roundId: gameData.roundId });
    }

    publishStartGame(gameData) {
        this.publishToAllUsers({ remainingTime: gameData.remainingTime });
    }
}
