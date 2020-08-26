import BaseEventPublisher from "./base-publisher";

export default class UserBetResultPublisher extends BaseEventPublisher {
    publish(userId, betResult) {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        this.publishToUser(userId, { status });
        // TODO: Send latest balance to players who are not in the room anymore.
    }
}
