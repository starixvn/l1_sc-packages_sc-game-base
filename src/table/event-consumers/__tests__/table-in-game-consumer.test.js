import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import InGameConsumer from "../../../core/event-consumers/in-game-consumer";
import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import RoundQuery from "../../../core/query-apis/round-query";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableInGameConsumer from "../table-in-game-consumer";

describe("TableInGameConsumer", () => {
    const definition = new TableGameDefinition({ id: 1, name: "name" });
    const gameData = new TableGameData(0);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
    const roundQuery = stub(RoundQuery);
    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);
    const getBalance = jest.fn();
    const consumer = new TableInGameConsumer(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);

    const stubPlayer = (uid, name) => {
        return {
            uid: {
                id: uid,
                profile: {
                    name,
                },
                session: {},
                rate: 1
            }
        }
    }

    afterEach(() => {
        jest.clearAllMocks();
    })

    it("inherit BaseInGameConsumer", () => {
        expect(consumer instanceof InGameConsumer);
    });

    it("buildPayload_always_calls Super", async () => {
        // arrange
        spyOn(InGameConsumer.prototype, "buildPayload");

        // act
        await consumer.buildPayload({ UID: "uid" });

        expect(InGameConsumer.prototype.buildPayload).toHaveBeenCalled();
    });

    describe("consume", () => {
        it("call specific methods", async () => {
            // arrange
            const socketClient = {
                emit: jest.fn(),
            };
            const user = {
                red: 1000,
                avatarId: 1,
                type: false,
            };
            spyOn(consumer, "buildPayload").and.returnValue({ user });
            const realPlayer = {
                UID: "uid",
                profile: {
                    name: "name",
                },
                socketClient,
            };

            // act
            await consumer.consume(realPlayer);

            // assert
            expect(consumer.buildPayload).toHaveBeenCalled();
            expect(socketClient.emit).toHaveBeenCalled();
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });

        it("emit players payloads", async () => {
            // arrange
            gameData.gameConfigs.enabled = true;
            const socketClient = {
                emit: jest.fn(),
            };
            const user = {
                red: 1000,
                avatarId: 1,
                type: false,
                rate: 2
            };
            const payload = { user }
            spyOn(consumer, "buildPayload").and.returnValue(payload);
            const realPlayer = {
                UID: "uid",
                profile: {
                    name: "name",
                },
                socketClient,
            };

            // act
            await consumer.consume(realPlayer);

            // assert
            expect(socketClient.emit).toHaveBeenCalledWith(definition.name, payload);
        });
    })

    describe("buildPlayersPayload", () => {
        it("returns empty when dont have other players", () => {
            // arrange
            gameData.players = {
                ...stubPlayer("player1", "name1"),
            };

            // act
            const result = consumer.buildPlayersPayload({ UID: "player1" });

            // assert
            expect(result).toBeEmpty();
        })

        it("returns list of other players", () => {
            // arrange
            gameData.players = {
                ...stubPlayer("player1", "name1"),
                ...stubPlayer("player2", "name2"),
            };

            // act
            const result = consumer.buildPlayersPayload({ UID: "player1" });

            // assert
            expect(Object.values(result).length).toBe(1);
            expect(Object.values(result)[0].id).toBe("player2");
        })
    })
});

