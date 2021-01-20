import { PlaceBetConsumer } from "../../../src/core/event-consumers";
import { BaseEventPublisher } from "../../../src/core/event-publishers";

jest.mock("../../../src/core/event-publishers/base-event-publisher");
describe("init consumer", () => {
    it("should init publisher", () => {
        new PlaceBetConsumer({}, {}, new BaseEventPublisher("", {}));

        expect(BaseEventPublisher).toHaveBeenCalledTimes(1);
    });
});
