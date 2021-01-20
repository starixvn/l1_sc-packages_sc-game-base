import PlaceBetConsumer from "../../../src/core/event-consumers/place-bet-consumer";
import BaseEventPublisher from "../../../src/core/event-publishers/base-event-publisher";

jest.mock("../../../src/core/event-publishers/base-event-publisher");

describe("Place Bet Consumer", () => {
    it("should init publisher", () => {
        new PlaceBetConsumer({}, {}, new BaseEventPublisher("", {}));

        expect(BaseEventPublisher).toHaveBeenCalledTimes(1);
    });
});
