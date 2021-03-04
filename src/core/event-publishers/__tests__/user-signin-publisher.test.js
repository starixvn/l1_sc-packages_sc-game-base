import UserSignInPublisher from "../user-signin-publisher";

describe("publishUnauthorizedMessage test", () => {
    it("should call emit to send to client", () => {
        const publisher = new UserSignInPublisher();
        const socketClient = { emit: jest.fn() };

        publisher.publishUnauthorizedMessage(socketClient);

        expect(socketClient.emit).toHaveBeenCalled();
    });
});
