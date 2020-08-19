import BaseEventPublisher from "./base-publisher";

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
