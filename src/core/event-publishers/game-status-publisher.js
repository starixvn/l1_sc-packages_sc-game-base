import BaseEventPublisher from "./base-publisher.js";

export default class GameStatusPublisher extends BaseEventPublisher {
    publishDisableGameStatus(gameConfigs) {
        const disabledMessage = gameConfigs?.disabled_message ?? "";
        const payload = { um: true, um_message: disabledMessage };

        this.publishToAllUsers(payload);
        this.publishToAllAdmins(payload);
    }

    publishPreviousDisableGameStatus({ gameData, gameConfigs }) {
        const configs = {
            minbet: gameConfigs.minbet,
            maxbet: gameConfigs.maxbet,
            choices_maxbet: gameConfigs.choices_maxbet,
            odds: gameConfigs.odds,
        };

        this.publishToAllUsers({ configs, remainingTime: gameData.remainingTime });
        this.publishToAllAdmins({ remainingTime: gameData.remainingTime, roundId: gameData.roundId });
    }

    publishStartGame(gameData) {
        this.publishToAllUsers({ remainingTime: gameData.remainingTime });
    }
}
