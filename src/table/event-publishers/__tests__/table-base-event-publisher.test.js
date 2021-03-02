import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import TableGameData from "../../table-game-data";
import TableBaseEventPublisher from "../table-base-event-publisher";

describe("table base event publisher test", () => {
    let gameData;
    let publisher;
    const socketClient = {
        emit: jest.fn(),
        connected: true
    };

    beforeEach(() => {
        gameData = new TableGameData(0)
        publisher = new TableBaseEventPublisher("game name", gameData);
        // arrange
        const userId = 123;

        gameData.realPlayers = {
            0: {
                UID: userId,
                socketClient: socketClient
            }
        };
    })


    it("inherit BaseEventPublisher", () => {
        expect(publisher instanceof BaseEventPublisher).toBeTruthy();
    })

    it("publishMessageBackToLobby_not existUser_not call emit event", () => {
        // act
        publisher.publishMessageBackToLobby(null);

        // assert
        expect(gameData.realPlayers[0].socketClient.emit).not.toHaveBeenCalled();
    })

    it("publishMessageBackToLobby_existUser_call emit event", () => {
        // act
        publisher.publishMessageBackToLobby(123);

        // assert
        expect(gameData.realPlayers[0].socketClient.emit).toHaveBeenCalled();
    })
})