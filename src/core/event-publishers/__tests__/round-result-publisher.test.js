import Chance from "chance";
import RoundResultPublisher from "../round-result-publisher";

describe("publishRoundResult", () => {
    describe("when result hash value exists", () => {
        it("should publish to all users with result hash value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                resultHash: {
                    rawValue: "xx",
                },
                result: "yy",
            };
            publisher.publishToAllUsers = jest.fn();
            publisher.publishToAllAdmins = jest.fn();

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith({
                finish: roundResult,
                resultHash: { rawValue: "xx", extraInfos: "yy" },
            });
        });

        it("should publish to all admins", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                resultHash: {
                    rawValue: "xx",
                },
                result: "yy",
            };
            publisher.publishToAllUsers = jest.fn();
            publisher.publishToAllAdmins = jest.fn();

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToAllAdmins).toHaveBeenCalledWith({ finish: roundResult });
        });
    });

    describe("when result hash value does not exist", () => {
        it("should publish to all users without result hash value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                resultHash: {},
            };
            publisher.publishToAllUsers = jest.fn();
            publisher.publishToAllAdmins = jest.fn();

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith({
                finish: roundResult,
            });
        });

        it("should publish to all admins", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                resultHash: {},
            };
            publisher.publishToAllUsers = jest.fn();
            publisher.publishToAllAdmins = jest.fn();

            // Act
            publisher.publishRoundResult(roundResult);

            // Assert
            expect(publisher.publishToAllAdmins).toHaveBeenCalledWith({ finish: roundResult });
        });
    });
});

describe("publishResultHash", () => {
    describe("when result hash value exists", () => {
        it("should publish result hash value to all users", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            publisher.gameData = {
                resultHash: {
                    hashValue: "hash1",
                },
            };
            publisher.publishToAllUsers = jest.fn();

            // Act
            publisher.publishResultHash();

            // Assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith({ resultHash: { hashValue: "hash1" } });
        });
    });

    describe("when result hash value does not exist", () => {
        it("should not publish result hash value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            publisher.gameData = {
                resultHash: {},
            };
            publisher.publishToAllUsers = jest.fn();

            // Act
            publisher.publishResultHash();

            // Assert
            expect(publisher.publishToAllUsers).not.toHaveBeenCalled();
        });
    });
});

describe("publishWinners", () => {
    it("should publish winners to all users", () => {
        // Arrange
        const chance = new Chance();
        const roundId = chance.natural();
        const winningPlayers = {};
        const publisher = new RoundResultPublisher();

        publisher.publishToAllUsers = jest.fn();

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
