import BaseEventPublisher from "./base-publisher.js";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        this.publishToAllUsers({
            finish: {
                roundId: roundResult.roundId,
                result: roundResult.result,
                settlementResult: roundResult.settlementResult,
            },
        });

        this.publishToAllAdmins(roundResult);
    }
}
