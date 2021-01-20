import { PlaceBetConsumer } from "../../../src/core/event-consumers";
import { PlaceBetPublisher } from "../../../src/core/event-publishers";

describe("init consumer", () => {
    it("should init publisher", () => {
        new PlaceBetConsumer({}, {});

        expect(PlaceBetPublisher).toHaveBeenCalledTimes(1);
    });
});
