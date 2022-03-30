import { generateMD5Result } from "../md5-helper";

describe("generateMD5Result", () => {
    it("should return rawValue as expected", () => {
        // Arrange
        const formattedResult = "abc";
        const roundId = 123;

        // Act
        const result = generateMD5Result(formattedResult, roundId);

        // Assert

        expect(result.rawValue).toMatch(/abc_{#123[a-z0-9]{21}}/);
    });

    it("should return hashValue with length = 32", () => {
        // Arrange
        const formattedResult = "abc";
        const roundId = 123;

        // Act
        const result = generateMD5Result(formattedResult, roundId);

        expect(result.hashValue.length).toBe(32);
    });
});
