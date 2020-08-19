import BaseEventPublisher from "./base-publisher";

export default class UserBetResultPublisher extends BaseEventPublisher {
    publish({ bet, betResult }) {
        const betStatus = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            betStatus.win = true;
            betStatus.bet = betResult.totalWin;
        } else {
            betStatus.win = false;
            betStatus.bet = betResult.totalLost;
        }

        this.publishToUser(bet.uid, { status: betStatus });
        // TODO: Send latest balance to players who are not in the room anymore.
    }
}
