import { stub } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import SettleGameRoundConsumer from "../../../core/event-consumers/settle-game-round-consumer";
import { RoundResultPublisher, UserBetResultPublisher } from "../../../core/event-publishers";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableSettleGameRoundConsumer from "../table-settle-game-round-consumer";
import GameManagementApiClientFactory from "../../../core/game-management-api";

jest.mock("sc-game-management-client");

describe("table settle game round consumer test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "game name" });
    const gameData = new TableGameData(0);

    /** @type {RoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    const endGame = jest.fn();

    /** @type {mongoose.Model}*/
    const roundsRepository = { find: () => {} };

    /** @type {mongoose.Model}*/
    const betsRepository = { find: () => {} };

    /** @type {mongoose.Model}*/
    const tempBetsRepository = { find: () => {} };
    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

    const consumer = new TableSettleGameRoundConsumer({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        tempBetsRepository,
        gameManagementApiClientFactory,
    });

    it("inherit settle game round consumer", () => {
        expect(consumer instanceof SettleGameRoundConsumer);
    });

    describe("queryBets", () => {
        it("should return correct result", async () => {
            // arrange
            const realPlayerBets = [{ round: 1, choice: "odd", amount: 10 }];
            const botBets = [{ round: 1, choice: "even", amount: 1 }];
            spyOn(betsRepository, "find").and.callFake(() => {
                return {
                    exec: () => {
                        return realPlayerBets;
                    },
                };
            });

            spyOn(tempBetsRepository, "find").and.callFake(() => {
                return {
                    exec: () => {
                        return botBets;
                    },
                };
            });

            // act
            const actualResult = await consumer.queryBets(1);

            // assert
            expect(actualResult).toEqual(realPlayerBets.concat(botBets));
        });
    });

    describe("captureBetResult_", () => {
        beforeEach(() => {
            // arrange
            spyOn(SettleGameRoundConsumer.prototype, "captureBetResult");
        });

        it("should calls super", () => {
            // act
            consumer.captureBetResult(1, {});

            // assert
            expect(SettleGameRoundConsumer.prototype.captureBetResult).toHaveBeenCalled();
        });

        describe("totalWin > 0", () => {
            it("should assign correct winningStatus", () => {
                // arrange
                const uid = 1;
                const betResult = {
                    totalBetAmount: 0,
                    totalWin: 1,
                    netWin: 0,
                    totalLost: 0,
                    winningByChoices: {},
                };
                gameData.winningPlayers = {};
                const winningStatus = {
                    rate: 1,
                    win: true,
                    bet: 1,
                    winningByChoices: {},
                };
                const player = {
                    id: uid,
                    name: "name",
                    red: 1000,
                    avatarId: 1,
                    type: false,
                };
                gameData.players[uid] = player;

                // act
                consumer.captureBetResult(uid, betResult);

                // assert
                expect(gameData.winningPlayers[uid]).toEqual(winningStatus);
                expect(gameData.players[uid].red).toEqual(1001);
            });
        });
    });
});
