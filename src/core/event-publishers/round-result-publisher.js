import BaseEventPublisher from "./base-event-publisher";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        this.publishToAllUsers({ ...payload, md5: { rawValue: this.gameData.md5.rawValue } });
        this.publishToAllAdmins(payload);
    }

    publishMD5() {
        this.publishToAllUsers({ md5: { hashValue: this.gameData.md5.hashValue } });
    }
}
