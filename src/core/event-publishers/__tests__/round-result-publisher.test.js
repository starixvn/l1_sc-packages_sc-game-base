import Chance from "chance";
import RoundResultPublisher from "../round-result-publisher";

describe("roundResultPublisher", () => {
    const chance = new Chance();
    const roundId = chance.natural();
    const result = chance.natural();
    const roundResult = {
        roundId,
        result,
    };
    const pf = {
        serverSeed: chance.guid(),
        serverSeedHash: chance.guid(),
        clientSeeds: [
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
            chance.integer({ min: 0, max: 9999 }),
        ],
        finalHash: chance.guid(),
    };

    let publisher;

    beforeEach(() => {
        publisher = new RoundResultPublisher();
        publisher.publishToAllUsers = jest.fn();
        publisher.publishToAllAdmins = jest.fn();
        publisher.gameData = { result, roundId };
    });

    describe("publishRoundResult", () => {
        describe("when exist gameData.pf", () => {
            beforeEach(() => {
                publisher.gameData.pf = pf;
            });

            it("should publish to all users with result and pf info", () => {
                // Arrange
                const expected = {
                    finish: { ...roundResult, pf: { ...pf, ...roundResult } },
                };

                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllUsers).toHaveBeenCalledWith(expected);
            });

            it("should publish to all admins", () => {
                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllAdmins).toHaveBeenCalledWith({ finish: roundResult });
            });
        });

        describe("when pf value does not exist", () => {
            it("should publish to all users without result hash value", () => {
                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllUsers).toHaveBeenCalledWith({
                    finish: roundResult,
                });
            });

            it("should publish to all admins", () => {
                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllAdmins).toHaveBeenCalledWith({ finish: roundResult });
            });
        });
    });

    describe("publishServerSeedHash", () => {
        describe("when server seed hash exists", () => {
            beforeEach(() => {
                publisher.gameData.pf = pf;
            });

            it("should publish server seed hash value to all users", () => {
                // Act
                publisher.publishServerSeedHash();

                // Assert
                expect(publisher.publishToAllUsers).toHaveBeenCalledWith({ pf: { serverSeedHash: pf.serverSeedHash, roundId } });
            });
        });

        describe("when server seed hash value does not exist", () => {
            it("should not publish server seed hash value", () => {
                // Act
                publisher.publishServerSeedHash();

                // Assert
                expect(publisher.publishToAllUsers).not.toHaveBeenCalled();
            });
        });
    });

    describe("publishWinners", () => {
        it("should publish winners to all users", () => {
            // Arrange
            const winningPlayers = {};

            // Act
            publisher.publishWinners(roundId, winningPlayers);

            // Assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith({
                winners: {
                    roundId,
                    winningPlayers,
                },
            });
        });
    });
});
