import Chance from "chance";
import { UserInfo, UserSession, GameConfig } from "jest-auto-fixture/src/models";
import { Choices } from "jest-auto-fixture/src/models/properties";
import { stub } from "jest-micro-auto-stub";
import BaseEventPublisher from "../../event-publishers/base-event-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import PlaceBetConsumer from "../place-bet-consumer";

describe("PlaceBetConsumer", () => {
    const chance = new Chance();
    const hedgeBetGroups = [["odd", "even"]];
    const durations = {
        wholeRound: 61,
        placingBets: 50,
        lockingBet: 5,
        mergeClientSeed: 1,
    };
    let consumer, definition, gameData, player, payload;

    /** @type {BaseEventPublisher}*/
    const baseEventPublisher = stub(BaseEventPublisher);

    beforeEach(() => {
        jest.clearAllMocks();
        gameData = initGameData();
        definition = new GameDefinition({ id: 1, name: "game name", durations, choices: Choices(), hedgeBetGroups }, jest.fn(), jest.fn());
        player = mockPlayer();
        payload = {
            betChoice: chance.pickone(definition.choices),
            amount: chance.natural(),
            freeBet: chance.bool(),
            roundId: chance.natural(),
            clientSeed: chance.natural(),
        };

        consumer = new PlaceBetConsumer(definition, gameData, baseEventPublisher);
    });

    describe("consume", () => {
        beforeEach(() => {
            consumer.validateBetRequest = jest.fn();
            consumer.adjustBetTracks = jest.fn();
        });

        it("should call validateBetRequest", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateBetRequest).toBeCalledWith(
                player,
                payload.betChoice,
                payload.amount,
                payload.freeBet,
                payload.roundId,
                payload.clientSeed
            );
        });

        describe("when bet request is invalid", () => {
            beforeEach(() => {
                consumer.validateBetRequest.mockReturnValueOnce(false);
            });

            it("should NOT call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).not.toBeCalled();
            });

            it("should NOT push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name]?.betQueue?.length ?? 0).toBe(0);
            });
        });

        describe("when bet request is valid", () => {
            beforeEach(() => {
                consumer.validateBetRequest.mockReturnValueOnce(true);
            });

            it("should call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).toBeCalledWith(player.profile.name, payload);
            });

            it("should push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name]?.betQueue.includes((bet) => bet.player === player && bet.payload === payload));
            });

            describe("when player info is NOT exist on ingame data", () => {
                it("should add player info to ingame data", () => {
                    // Arrange
                    gameData.ingame = {};

                    // Act
                    consumer.consume(player, payload);

                    // Assert
                    expect(gameData.ingame[player.profile.name]).toBeDefined();
                });
            });
        });
    });

    describe("composeValidationCriteria", () => {
        it("should return a array of all validation criteria results", () => {
            // Arrange
            const bettingTimeValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const betAmountValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const betChoiceValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const hedgeBetValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const clientSeedValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const expectedResult = bettingTimeValidationResult.concat(
                betChoiceValidationResult,
                betAmountValidationResult,
                hedgeBetValidationResult,
                clientSeedValidationResult
            );

            consumer.composeBettingTimeValidationCriteria = jest.fn().mockReturnValueOnce(bettingTimeValidationResult);
            consumer.composeBetAmountValidationCriteria = jest.fn().mockReturnValueOnce(betAmountValidationResult);
            consumer.composeBetChoiceValidationCriteria = jest.fn().mockReturnValueOnce(betChoiceValidationResult);
            consumer.composeHedgeBetValidationCriteria = jest.fn().mockReturnValueOnce(hedgeBetValidationResult);
            consumer.composeClientSeedValidationCriteria = jest.fn().mockReturnValueOnce(clientSeedValidationResult);

            // Act
            const actualResult = consumer.composeValidationCriteria(
                player,
                payload.betChoice,
                payload.amount,
                payload.freeBet,
                payload.roundId
            );

            // Assert
            expect(actualResult).toStrictEqual(expectedResult);
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        beforeEach(() => {
            consumer.getNoticeObj = jest.fn();
        });

        describe("game enabled validation criteria", () => {
            describe("when game is NOT enabled", () => {
                it("should return failure with invalid bet notice", () => {
                    // Arrange
                    gameData.gameConfigs.enabled = false;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[0].failure).toBe(true);
                });
            });

            describe("when game is enabled", () => {
                it("should return no failure with enabled config", () => {
                    // Arrange
                    gameData.gameConfigs.enabled = true;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[0].failure).toBe(false);
                });
            });
        });

        describe("betting round validation criteria", () => {
            describe("when roundId is NOT game data roundId", () => {
                it("should return failure with invalid bet notice", () => {
                    // Arrange
                    const roundId = gameData.roundId + 1;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(roundId);

                    // Assert
                    expect(actualResult[1].failure).toBe(true);
                });
            });

            describe("when roundId is game data roundId", () => {
                it("should return no failure with roundId", () => {
                    // Arrange
                    const roundId = gameData.roundId;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(roundId);

                    // Assert
                    expect(actualResult[1].failure).toBe(false);
                });
            });
        });

        describe("betting time validation criteria", () => {
            describe("when remaining time is less than locking bet time", () => {
                it("should return failure with place bet next round notice", () => {
                    // Arrange
                    gameData.remainingTime = durations.lockingBet - 1;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[2].failure).toBe(true);
                });
            });

            describe("when remaining time is greater than placing bet time", () => {
                it("should return failure with place bet next round notice", () => {
                    // Arrange
                    gameData.remainingTime = durations.placingBets + 1;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[2].failure).toBe(true);
                });
            });

            describe("when remaining time is equal to placing bet time", () => {
                it("should return failure with place bet next round notice", () => {
                    // Arrange
                    gameData.remainingTime = durations.placingBets;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[2].failure).toBe(true);
                });
            });

            describe("when remaining time is in valid time for betting", () => {
                it("should return no failure with betting time", () => {
                    // Arrange
                    gameData.remainingTime = durations.placingBets - 2;

                    // Act
                    const actualResult = consumer.composeBettingTimeValidationCriteria(chance.natural());

                    // Assert
                    expect(actualResult[2].failure).toBe(false);
                });
            });
        });
    });

    describe("composeBetAmountValidationCriteria", () => {
        beforeEach(() => {
            consumer.getNoticeObj = jest.fn();
            player.session.currencyGroupId = "1";
            player.profile.minBet = 1;
            player.profile.maxBet = 2000;
        });

        describe("free bet validation criteria", () => {
            describe("when bet is NOT free bet", () => {
                it("should return no failure with free bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, payload.amount, false);

                    // Assert
                    expect(actualResult[0].failure).toBe(false);
                });
            });

            describe("when bet is free bet", () => {
                describe("when free bet config is NOT enabled", () => {
                    it("should return failure with free bet", () => {
                        // Arrange
                        gameData.gameConfigs.enableFreeBet = false;

                        // Act
                        const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, payload.amount, true);

                        // Assert
                        expect(actualResult[0].failure).toBe(true);
                    });
                });

                describe("when free bet config is enabled", () => {
                    it("should return no failure with free bet", () => {
                        // Arrange
                        gameData.gameConfigs.enableFreeBet = true;

                        // Act
                        const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, payload.amount, true);

                        // Assert
                        expect(actualResult[0].failure).toBe(false);
                    });
                });
            });
        });

        describe("total bet on choice validation criteria", () => {
            describe("when total bet on choice is greater than maxBetPerChoice", () => {
                it("should return failure with max bet per choice", () => {
                    // Arrange
                    const betChoice = "odd";
                    gameData.ingame[player.profile.name] = { betTracks: { [betChoice]: 1000 } };

                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, betChoice, 1500, payload.freeBet);

                    // Assert
                    expect(actualResult[1].failure).toBe(true);
                });
            });

            describe("when total bet on choice is NOT greater than maxBetPerChoice", () => {
                it("should return no failure with max bet per choice", () => {
                    // Arrange
                    const betChoice = "even";
                    gameData.ingame[player.profile.name] = { betTracks: { [betChoice]: 1100 } };

                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, betChoice, 1000, payload.freeBet);

                    // Assert
                    expect(actualResult[1].failure).toBe(true);
                });
            });
        });

        describe("min bet validation criteria", () => {
            describe("when bet amount is less than minBet", () => {
                it("should return failure with min bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, 0, payload.freeBet);

                    // Assert
                    expect(actualResult[2].failure).toBe(true);
                });
            });

            describe("when bet amount is NOT less than minBet", () => {
                it("should return no failure with min bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, 100, payload.freeBet);

                    // Assert
                    expect(actualResult[2].failure).toBe(false);
                });
            });
        });

        describe("max bet validation criteria", () => {
            describe("when bet amount is greater than maxBet", () => {
                it("should return failure with max bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, 2500, payload.freeBet);

                    // Assert
                    expect(actualResult[3].failure).toBe(true);
                });
            });

            describe("when bet amount is NOT greater than maxBet", () => {
                it("should return no failure with max bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, payload.betChoice, 1500, payload.freeBet);

                    // Assert
                    expect(actualResult[3].failure).toBe(false);
                });
            });
        });

        describe("total bet amount on round validation criteria", () => {
            beforeEach(() => {
                gameData.ingame[player.profile.name] = { betTracks: { odd: 500, white3: 500 } };
            });

            describe("when total bet amount is greater than maxBet", () => {
                it("should return failure with max bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, "even", 1100, payload.freeBet);

                    // Assert
                    expect(actualResult[4].failure).toBe(true);
                });
            });

            describe("when total bet amount is NOT greater than maxBet", () => {
                it("should return no failure with max bet", () => {
                    // Act
                    const actualResult = consumer.composeBetAmountValidationCriteria(player, "even", 300, payload.freeBet);

                    // Assert
                    expect(actualResult[4].failure).toBe(false);
                });
            });
        });
    });

    describe("composeBetChoiceValidationCriteria", () => {
        describe("when betChoice is valid", () => {
            it("should return no failure", () => {
                // Act
                const actualResult = consumer.composeBetChoiceValidationCriteria(chance.pickone(definition.choices));

                // Assert
                expect(actualResult[0].failure).toBe(false);
            });
        });

        describe("when betChoice is invalid", () => {
            it("should return failure with invalid bet choice notice", () => {
                // Act
                const actualResult = consumer.composeBetChoiceValidationCriteria("invalid");

                // Assert
                expect(actualResult[0].failure).toBe(true);
            });
        });
    });

    describe("composeHedgeBetValidationCriteria", () => {
        describe("when hedge bet group config is empty", () => {
            it("should return no failure", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: { even: 200 } };
                definition.hedgeBetGroups = [];

                // Act
                const actualResult = consumer.composeHedgeBetValidationCriteria("odd", player);

                // Assert
                expect(!!actualResult[0].failure).toBe(false);
            });
        });

        describe("when bet choice is violated hedge bet criteria", () => {
            it("should return failure with hedge bet notice", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: { odd: 500 } };

                // Act
                const actualResult = consumer.composeHedgeBetValidationCriteria("even", player);

                // Assert
                expect(!!actualResult[0].failure).toBe(true);
            });
        });

        describe("when bet choice is NOT violated hedge bet criteria", () => {
            it("should return NO failure with hedge bet notice", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: { odd: 500 } };

                // Act
                const actualResult = consumer.composeHedgeBetValidationCriteria("odd", player);

                // Assert
                expect(!!actualResult[0].failure).toBe(false);
            });
        });
    });

    describe("composeClientSeedValidationCriteria", () => {
        const clientSeed = chance.natural({ min: 0, max: 9999 });
        describe("when durations.mergeClientSeeds is undefined", () => {
            it("should return NO failure", () => {
                // Arrange
                consumer.definition.durations.mergeClientSeeds = undefined;

                // Act
                const result = consumer.composeClientSeedValidationCriteria(clientSeed);

                // Assert
                expect(result[0].failure).toBe(false);
            });
        });

        describe("when durations.mergeClientSeeds is defined", () => {
            describe("when client is valid", () => {
                it("should return NO failure", () => {
                    // Arrange
                    consumer.definition.durations.mergeClientSeeds = chance.natural();

                    // Act
                    const result = consumer.composeClientSeedValidationCriteria(clientSeed);

                    // Assert
                    expect(result[0].failure).toBe(false);
                });
            });

            describe("when client is NOT valid", () => {
                it("should return failure", () => {
                    // Arrange
                    consumer.definition.durations.mergeClientSeeds = chance.natural();

                    // Act
                    const result = consumer.composeClientSeedValidationCriteria("");

                    // Assert
                    expect(result[0].failure).toBe(true);
                });
            });
        });
    });

    describe("validateBetRequest", () => {
        describe("when amount is not valid", () => {
            it("should return false", () => {
                // Act
                const actualResult = consumer.validateBetRequest(player, payload.betChoice, undefined, payload.freeBet, payload.roundId);

                // Assert
                expect(actualResult).toBe(false);
            });
        });

        describe("when bet choice is not valid", () => {
            it("should return false", () => {
                // Act
                const actualResult = consumer.validateBetRequest(player, undefined, payload.amount, payload.freeBet, payload.roundId);

                // Assert
                expect(actualResult).toBe(false);
            });
        });

        describe("when amount and bet choice is valid", () => {
            beforeEach(() => {
                consumer.composeValidationCriteria = jest.fn();
            });

            it("should call composeValidationCriteria", () => {
                // Arrange
                consumer.composeValidationCriteria.mockReturnValueOnce([]);

                // Act
                consumer.validateBetRequest(player, payload.betChoice, payload.amount, payload.freeBet, payload.roundId);

                // Assert
                expect(consumer.composeValidationCriteria).toBeCalled();
            });

            describe("when having failed criterion", () => {
                const betFailedNotice = "bet failed";

                beforeEach(() => {
                    consumer.composeValidationCriteria.mockReturnValueOnce([{ failure: true, notice: betFailedNotice }]);
                });

                it("should call publishToUser", () => {
                    // Act
                    consumer.validateBetRequest(player, payload.betChoice, payload.amount, payload.freeBet, payload.roundId);

                    // Assert
                    expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                        endBet: -1,
                        betChoice: payload.betChoice,
                        notice: betFailedNotice,
                    });
                });

                it("should return false", () => {
                    // Act
                    const actualResult = consumer.validateBetRequest(
                        player,
                        payload.betChoice,
                        payload.amount,
                        payload.freeBet,
                        payload.roundId
                    );

                    // Assert
                    expect(actualResult).toBe(false);
                });
            });

            describe("whne having NO failed criterion", () => {
                it("should return true", () => {
                    // Arrange
                    consumer.composeValidationCriteria.mockReturnValueOnce([{ failure: false, notice: "bet failed" }]);

                    // Act
                    const actualResult = consumer.validateBetRequest(
                        player,
                        payload.betChoice,
                        payload.amount,
                        payload.freeBet,
                        payload.roundId
                    );

                    // Assert
                    expect(actualResult).toBe(true);
                });
            });
        });
    });

    describe("adjustBetTrack", () => {
        describe("when having player info on ingame data", () => {
            it("should update player betTracks", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: {} };

                // Act
                consumer.adjustBetTracks(player.profile.name, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betTracks[payload.betChoice]).toEqual(payload.amount);
            });
        });
    });

    function mockPlayer() {
        const userInfo = UserInfo();
        const userSession = UserSession();

        return {
            UID: userInfo.UID,
            profile: { ...userInfo },
            session: { ...userSession },
        };
    }

    function initGameData() {
        const defaultGameData = new GameData();
        defaultGameData.remainingTime = 20;
        defaultGameData.gameConfigs = GameConfig();
        defaultGameData.currencyGroupGames = [
            {
                groupId: "1",
                minBet: 1,
                maxBet: 2000,
                maxBetPerChoices: { odd: 2000, even: 2000, red2: 500, red3: 500, red4: 500, white3: 500, white4: 500 },
            },
        ];

        return defaultGameData;
    }
});
