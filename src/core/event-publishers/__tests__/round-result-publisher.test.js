import GameData from "../../game-data";
import RoundResultPublisher from "../round-result-publisher";

describe("publishRoundResult", () => {
    describe("when md5 value exists", () => {
        it("should publish to all users with md5 value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                md5: {
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
                md5: { rawValue: "xx", extraInfos: "yy" },
            });
        });

        it("should publish to all admins", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                md5: {
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

    describe("when md5 value does not exist", () => {
        it("should publish to all users without md5 value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            const roundResult = { red1: true, red2: false };
            publisher.gameData = {
                md5: {},
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
                md5: {},
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

describe("publishMD5", () => {
    describe("when md5 value exists", () => {
        it("should publish md5 value to all users", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            publisher.gameData = {
                md5: {
                    hashValue: "hash1",
                },
            };
            publisher.publishToAllUsers = jest.fn();

            // Act
            publisher.publishMD5();

            // Assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith({ md5: { hashValue: "hash1" } });
        });
    });

    describe("when md5 value does not exist", () => {
        it("should not publish md5 value", () => {
            // Arrange
            const publisher = new RoundResultPublisher();
            publisher.gameData = {
                md5: {},
            };
            publisher.publishToAllUsers = jest.fn();

            // Act
            publisher.publishMD5();

            // Assert
            expect(publisher.publishToAllUsers).not.toHaveBeenCalled();
        });
    });
});
