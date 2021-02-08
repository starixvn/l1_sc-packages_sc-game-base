import "jest-extended";

import { stub } from "jest-micro-auto-stub";

import UserDisconnectConsumer from "../../../src/core/event-consumers/user-disconnect-consumer";
import BaseEventPublisher from "../../../src/core/event-publishers/base-event-publisher";
import TableOutGameConsumer from "../../../src/table/event-consumers/table-out-game-consumer";
import TableGameData from "../../../src/table/table-game-data";

describe("table out game consumer test", () => {
    const socketClient = {
        emit: jest.fn(),
    };
    const publisher = stub(BaseEventPublisher);
    /** @type {TableGameData}*/
    let gameData;
    /** @type {TableOutGameConsumer}*/
    let consumer;

    beforeEach(() => {
        gameData = new TableGameData(0);
        consumer = new TableOutGameConsumer(gameData, publisher);
        spyOn(UserDisconnectConsumer.prototype, "consume");
    });

    it("Inherit UserDisconnectConsumer", () => {
        expect(consumer instanceof UserDisconnectConsumer);
    });

    describe("consume", () => {
        it("Always_Call super.consume", () => {
            // act
            consumer.consume(socketClient);

            // assert
            expect(UserDisconnectConsumer.prototype.consume).toHaveBeenCalled();
        });

        it("existPlayer_publish out game message", () => {
            // arrange
            spyOn(publisher, "publishToAllUsers");
            const socketId = 123;
            gameData.realPlayers = {
                [socketId]: {},
            };

            // act
            consumer.consume({ id: socketId });

            // assert
            expect(publisher.publishToAllUsers).toHaveBeenCalled();
        });
    });
});
