import BaseEventPublisher from "./base-event-publisher";

export default class RoundResultPublisher extends BaseEventPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        if (this.gameData.pf) {
            this.publishToAllUsers({
                finish: {
                    ...roundResult,
                    pf: {
                        ...this.gameData.pf,
                        roundId: this.gameData.roundId,
                        result: this.gameData.result,
                    },
                },
            });
        } else {
            this.publishToAllUsers(payload);
        }

        this.publishToAllAdmins(payload);
    }

    publishServerSeedHash() {
        const serverSeedHash = this.gameData.pf?.serverSeedHash;

        if (serverSeedHash) {
            const pf = { serverSeedHash, roundId: this.gameData.roundId };

            this.publishToAllUsers({ pf });
        }
    }

    publishWinners(roundId, winningPlayers) {
        const payload = {
            roundId,
            winningPlayers,
        };

        this.publishToAllUsers({
            winners: payload,
        });
    }
}
