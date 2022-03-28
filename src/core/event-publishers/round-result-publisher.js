import BaseEventPublisher from "./base-event-publisher";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        if (this.gameData.resultHash.rawValue) {
            this.publishToAllUsers({
                ...payload,
                resultHash: { rawValue: this.gameData.resultHash.rawValue, extraInfos: this.gameData.result },
            });
        } else {
            this.publishToAllUsers(payload);
        }

        this.publishToAllAdmins(payload);
    }

    publishResultHash() {
        if (this.gameData.resultHash.hashValue) {
            this.publishToAllUsers({ resultHash: { hashValue: this.gameData.resultHash.hashValue } });
        }
    }
}
