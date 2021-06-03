import "jest-extended";

import UserSignInPublisher from "../../../core/event-publishers/user-signin-publisher";
import TableUserSignInPublisher from "../table-user-signin-publisher";

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
        publisher.publishUmNotice(socketClient, {"en-US": "UM"});

        // assert
        expect(socketClient.emit).toHaveBeenCalledWith("message", { um_message: {"en-US": "UM"}, um: true });
    });
});
