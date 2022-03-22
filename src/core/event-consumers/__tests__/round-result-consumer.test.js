import RoundResultConsumer from "../round-result-consumer";
import { encrypt } from "../../helpers/crypto-helper";

describe("generateResultAndPublishMD5", () => {
    describe("when md5sRepository null", () => {
        it("should not publish MD5", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.roundResultPublisher.publishMD5).not.toHaveBeenCalled();
        });
    });

    describe("when md5sRepository not null", () => {
        it("should publish MD5", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };
            consumer.md5sRepository = jest.fn();
            consumer.generateResult = jest.fn();
            consumer.buildMD5 = jest.fn();
            consumer.createMD5Record = jest.fn();
            consumer.gameData = {};

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.roundResultPublisher.publishMD5).toHaveBeenCalled();
        });
    });

    describe("when lastMD5Record exists and matches with current roundId", () => {
        it("should decrypt result from lastMD5Record", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastMD5Record = {
                encryptedResult: {
                    iv: "477764b581bbaa674ca639ef1b7dee96",
                    content: "efd5bb24b2511bdbdc0715ea64777d3a11797192a31d050a06cfe5ca67b16d9031e2cebace24d6d7f2a1a12e48fc5511444f70",
                },
                encryptedMD5: {
                    iv: "e4f2f2847687e00f3eb05f532ccba3a1",
                    content:
                        "d1f4117877a6e9170e34050ab229789a5af4a8500565d221f70e95ceb3fa3e8db5700ece4e894c781f2008bf68ed719eb99baee0422edb00d55138460e436acd721a2816b74070bc51d82a887ee4b8580af8090f17741ea65df84743309ae24e08868aee22bb79ac192aa141f2d6fb0ea8d2c1",
                },
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.md5sRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5(lastMD5Record);

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: false, red3: false, red4: true });
        });

        it("should decrypt md5 from lastMD5Record", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastMD5Record = {
                encryptedResult: {
                    iv: "477764b581bbaa674ca639ef1b7dee96",
                    content: "efd5bb24b2511bdbdc0715ea64777d3a11797192a31d050a06cfe5ca67b16d9031e2cebace24d6d7f2a1a12e48fc5511444f70",
                },
                encryptedMD5: {
                    iv: "e4f2f2847687e00f3eb05f532ccba3a1",
                    content:
                        "d1f4117877a6e9170e34050ab229789a5af4a8500565d221f70e95ceb3fa3e8db5700ece4e894c781f2008bf68ed719eb99baee0422edb00d55138460e436acd721a2816b74070bc51d82a887ee4b8580af8090f17741ea65df84743309ae24e08868aee22bb79ac192aa141f2d6fb0ea8d2c1",
                },
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.md5sRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5(lastMD5Record);

            // Assert
            expect(consumer.gameData.md5).toEqual({
                hashValue: "3faf23109c676e277914961d3059f92e",
                rawValue: "{1001}_#140117784fc71db4cffb9919dd5",
                roundId: 1401177,
            });
        });
    });

    describe("when lastMD5Record does not exist and settlementResultFromAdmin exist", () => {
        it("should get result from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: false, red3: true, red4: false });
        });

        it("should build md5 from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.md5.roundId).toBe(11);
            expect(consumer.gameData.md5.rawValue).toContain("1010_#11");
        });

        it("should create md5 record from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn(),
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };
            consumer.getNewDate = () => 123;

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.md5sRepository.create).toHaveBeenCalled();
        });
    });
});
