import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import TableGameData from "../../table-game-data";
import TableBaseEventPublisher from "../table-base-event-publisher";

describe("table base event publisher test", () => {
    const gameData = new TableGameData(0)
    const publisher = new TableBaseEventPublisher("game name", gameData);

    it("inherit BaseEventPublisher", () => {
        expect(publisher instanceof BaseEventPublisher).toBeTruthy();
    })

    it("publishMessageBackToLobby_existUser_call emit event", () => {
        // arrange
        const userId = 123;
        const socketClient = {
            emit: jest.fn(),
            connected: true

        };
        gameData.realPlayers = {
            [1]: {
                UID: userId,
                socketClient: socketClient
            }
        };

        // act
        publisher.publishMessageBackToLobby(userId);

        // assert
        expect(socketClient.emit).toHaveBeenCalled();
    })
})