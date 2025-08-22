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
            consumer.validateRequestParams = jest.fn();
            consumer.validateBetRequest = jest.fn();
            consumer.adjustBetTracks = jest.fn();
        });

        it("should call validateRequestParams", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateRequestParams).toBeCalledWith(payload, player);
        });

        describe("when requestParams is NOT valid", () => {
            beforeEach(() => {
                consumer.validateRequestParams.mockReturnValueOnce(false);
            });

            it("should NOT call validateBetRequest", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.validateBetRequest).not.toBeCalled();
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

        describe("when requestParams is valid", () => {
            beforeEach(() => {
                consumer.validateRequestParams.mockReturnValueOnce(true);
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
                    payload.roundId
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
                    expect(
                        gameData.ingame[player.profile.name]?.betQueue.includes((bet) => bet.player === player && bet.payload === payload)
                    );
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
    });

    describe("composeValidationCriteria", () => {
        it("should return a array of all validation criteria results", () => {
            // Arrange
            const bettingTimeValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const betAmountValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const betChoiceValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const hedgeBetValidationResult = [{ failure: chance.bool(), notice: chance.string() }];
            const expectedResult = bettingTimeValidationResult.concat(
                betChoiceValidationResult,
                betAmountValidationResult,
                hedgeBetValidationResult
            );

            consumer.composeBettingTimeValidationCriteria = jest.fn().mockReturnValueOnce(bettingTimeValidationResult);
            consumer.composeBetAmountValidationCriteria = jest.fn().mockReturnValueOnce(betAmountValidationResult);
            consumer.composeBetChoiceValidationCriteria = jest.fn().mockReturnValueOnce(betChoiceValidationResult);
            consumer.composeHedgeBetValidationCriteria = jest.fn().mockReturnValueOnce(hedgeBetValidationResult);

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

    describe("composeRequestParamsValidationCriteria", () => {
        describe("when amount is not defined", () => {
            it("should return failure", () => {
                // Act
                const actualResult = consumer.composeRequestParamsValidationCriteria({ ...payload, amount: undefined });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });
        });

        describe("when betChoice is not defined", () => {
            it("should return failure", () => {
                // Act
                const actualResult = consumer.composeRequestParamsValidationCriteria({ ...payload, betChoice: undefined });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });
        });

        describe("when definition.provablyFair is NOT defined", () => {
            it("should return NO failure", () => {
                // Arrange
                consumer.definition.provablyFair = undefined;

                // Act
                const actualResult = consumer.composeRequestParamsValidationCriteria({ ...payload, betChoice: "odd", amount: 1 });

                // Assert
                expect(actualResult.every((x) => x.failure === false)).toBeTruthy();
            });
        });

        describe("when definition.provablyFair is defined", () => {
            beforeEach(() => {
                consumer.definition.provablyFair = true;
            });

            describe("when clientSeed is valid", () => {
                it("should return NO failure", () => {
                    // Act
                    const actualResult = consumer.composeRequestParamsValidationCriteria({
                        ...payload,
                        clientSeed: chance.natural({ min: 0, max: 9999 }),
                    });

                    // Assert
                    expect(actualResult[1].failure).toBeFalsy();
                });
            });

            describe("when clientSeed is invalid", () => {
                it("should return failure", () => {
                    // Act
                    const actualResult = consumer.composeRequestParamsValidationCriteria({ ...payload, betChoice: undefined });

                    // Assert
                    expect(actualResult[2].failure).toBeTruthy();
                });
            });
        });
    });

    describe("validateClientSeed", () => {
        beforeEach(() => {
            consumer.definition.provablyFair = true;
        });

        describe("when clientSeed is invalid", () => {
            it("should return failure", () => {
                //Arrange
                const clientSeed = "99999";

                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });

            it("should return failure", () => {
                //Arrange
                const clientSeed = "1aa";

                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });

            it("should return failure", () => {
                //Arrange
                const clientSeed = "aaa1";
                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });

            it("should return failure", () => {
                //Arrange
                const clientSeed = "0a";
                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });

            it("should return failure", () => {
                //Arrange
                const clientSeed = "-1";
                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBeTruthy();
            });
        });

        describe("when clientSeed is valid", () => {
            it("should NOT return failure", () => {
                //Arrange
                const clientSeed = "9999";

                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBe(false);
            });

            it("should NOT return failure", () => {
                //Arrange
                const clientSeed = "11";

                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBe(false);
            });

            it("should NOT return failure", () => {
                //Arrange
                const clientSeed = "000";
                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBe(false);
            });

            it("should NOT return failure", () => {
                //Arrange
                const clientSeed = "0011";
                // Act
                const actualResult = consumer.validateClientSeed({ clientSeed });

                // Assert
                expect(actualResult[0].failure).toBe(false);
            });
        });
    });

    describe("validateRequestParams", () => {
        beforeEach(() => {
            consumer.composeRequestParamsValidationCriteria = jest.fn();
            consumer.verifyCriteria = jest.fn();
        });

        it("should call composeRequestParamsValidationCriteria", () => {
            // Arrange
            consumer.composeRequestParamsValidationCriteria.mockReturnValueOnce([]);

            // Act
            consumer.validateRequestParams(payload, player);

            // Assert
            expect(consumer.composeRequestParamsValidationCriteria).toBeCalledWith(payload);
        });

        it("should call composeRequestParamsValidationCriteria", () => {
            // Arrange
            const verifyResult = chance.bool();
            consumer.verifyCriteria.mockReturnValueOnce(verifyResult);
            consumer.composeRequestParamsValidationCriteria.mockReturnValueOnce([]);

            // Act
            consumer.validateRequestParams(payload, player);

            // Assert
            expect(consumer.verifyCriteria).toBeCalledWith([], player, payload.betChoice);
        });

        it("should return verifyCriteria result", () => {
            // Arrange
            const verifyResult = chance.bool();
            consumer.verifyCriteria.mockReturnValueOnce(verifyResult);
            consumer.composeRequestParamsValidationCriteria.mockReturnValueOnce([]);

            // Act
            const actualResult = consumer.validateRequestParams(payload, player);

            // Assert
            expect(actualResult).toBe(verifyResult);
        });
    });

    describe("validateBetRequest", () => {
        beforeEach(() => {
            consumer.composeValidationCriteria = jest.fn();
            consumer.verifyCriteria = jest.fn();
        });

        it("should call composeValidationCriteria", () => {
            // Arrange
            consumer.composeValidationCriteria.mockReturnValueOnce([]);

            // Act
            consumer.validateBetRequest(player, payload.betChoice, payload.amount, payload.freeBet, payload.roundId);

            // Assert
            expect(consumer.composeValidationCriteria).toBeCalledWith(
                player,
                payload.betChoice,
                payload.amount,
                payload.freeBet,
                payload.roundId
            );
        });

        it("should call composeValidationCriteria", () => {
            // Arrange
            const verifyResult = chance.bool();
            consumer.verifyCriteria.mockReturnValueOnce(verifyResult);
            consumer.composeValidationCriteria.mockReturnValueOnce([]);

            // Act
            consumer.validateBetRequest(player, payload.betChoice, payload.amount, payload.freeBet, payload.roundId);

            // Assert
            expect(consumer.verifyCriteria).toBeCalledWith([], player, payload.betChoice);
        });

        it("should return verifyCriteria result", () => {
            // Arrange
            const verifyResult = chance.bool();
            consumer.verifyCriteria.mockReturnValueOnce(verifyResult);
            consumer.composeValidationCriteria.mockReturnValueOnce([]);

            // Act
            const actualResult = consumer.validateBetRequest(player, payload.betChoice, payload.amount, payload.freeBet, payload.roundId);

            // Assert
            expect(actualResult).toBe(verifyResult);
        });
    });

    describe("verifyCriteria", () => {
        describe("when having failed criterion", () => {
            const betFailedNotice = "bet failed";
            const criteria = [{ failure: true, notice: betFailedNotice }];

            it("should call publishToUser", () => {
                // Act
                consumer.verifyCriteria(criteria, player, payload.betChoice);

                // Assert
                expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    betChoice: payload.betChoice,
                    notice: betFailedNotice,
                });
            });

            it("should return false", () => {
                // Act
                const actualResult = consumer.verifyCriteria(criteria, player, payload.betChoice);

                // Assert
                expect(actualResult).toBe(false);
            });
        });

        describe("when having NO failed criterion", () => {
            const criteria = [{ failure: false, notice: "bet failed" }];

            it("should NOT call publishToUser", () => {
                // Act
                consumer.verifyCriteria(criteria, player, payload.betChoice);

                // Assert
                expect(baseEventPublisher.publishToUser).not.toBeCalled();
            });

            it("should return true", () => {
                // Act
                const actualResult = consumer.verifyCriteria(criteria, player, payload.betChoice);

                // Assert
                expect(actualResult).toBe(true);
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
