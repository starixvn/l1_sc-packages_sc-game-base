import "jest-extended";

import UserSignInPublisher from "../../../src/core/event-publishers/user-signin-publisher";
import TableUserSignInPublisher from "../../../src/table/event-publishers/table-user-signin-publisher";

describe("table user signin publisher test", () => {
    const socketClient = {
        emit: jest.fn(),
    };

    const publisher = new TableUserSignInPublisher();

    it("Inherit UserSignInPublisher", () => {
        expect(publisher instanceof UserSignInPublisher).toBeTruthy();
    });

    it("publishToGameMessage", () => {
        // act
        publisher.publishToGameMessage(socketClient, "game name");

        // assert
        expect(socketClient.emit).toHaveBeenCalledWith("message", { toGame: "game name" });
    });

    it("publishUmNotice", () => {
        // act
        publisher.publishUmNotice(socketClient, "notice");

        // assert
        expect(socketClient.emit).toHaveBeenCalledWith("message", { notice: "notice", um: true });
    });
});
