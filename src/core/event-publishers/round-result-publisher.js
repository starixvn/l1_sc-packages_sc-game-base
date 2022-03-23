import BaseEventPublisher from "./base-event-publisher";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        if (this.gameData.md5.rawValue) {
            this.publishToAllUsers({ ...payload, md5: { rawValue: this.gameData.md5.rawValue, extraInfos: this.gameData.result } });
        } else {
            this.publishToAllUsers(payload);
        }

        this.publishToAllAdmins(payload);
    }

    publishMD5() {
        if (this.gameData.md5.hashValue) {
            this.publishToAllUsers({ md5: { hashValue: this.gameData.md5.hashValue } });
        }
    }
}
