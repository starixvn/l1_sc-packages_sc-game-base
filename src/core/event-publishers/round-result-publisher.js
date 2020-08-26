import BaseEventPublisher from "./base-publisher";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        this.publishToAllUsers({ finish: roundResult });
        this.publishToAllAdmins(roundResult);
    }
}
