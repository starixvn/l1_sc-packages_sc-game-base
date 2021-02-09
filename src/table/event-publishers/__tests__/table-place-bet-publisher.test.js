import "jest-extended";

import PlaceBetPublisher from "../../../core/event-publishers/place-bet-publisher";
import TableGameData from "../../table-game-data";
import TablePlaceBetPublisher from "../table-place-bet-publisher";

describe("table place bet publisher test", () => {
    const gameData = new TableGameData(0);
    const publisher = new TablePlaceBetPublisher("game name", gameData);

    beforeEach(() => {
        spyOn(PlaceBetPublisher.prototype, "publishSuccessBet");
        spyOn(publisher, "publishToAllUsersExcept");
    });

    it("inherit PlaceBetPublisher", () => {
        expect(publisher instanceof PlaceBetPublisher).toBeTruthy();
    });

    describe("publishSuccessBet_always", () => {
        beforeEach(() => {
            publisher.publishSuccessBet(1, {});
        });

        it("calls super.publishSuccessBet", () => {
            expect(PlaceBetPublisher.prototype.publishSuccessBet).toHaveBeenCalled();
        });

        it("calls publishToAllUsersExcept", () => {
            expect(publisher.publishToAllUsersExcept).toHaveBeenCalled();
        });
    });
});
