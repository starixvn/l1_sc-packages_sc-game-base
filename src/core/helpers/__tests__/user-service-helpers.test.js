import Chance from "chance";
import { signInGame } from "../user-service-helpers";

jest.mock("axios", () => {
    return {
        post: () => {
            return { data: "Post Result" };
        },
    };
});

jest.mock("../authentication-helpers", () => {
    return {
        post: () => {
            return { data: "Post Result" };
        },
    };
});

describe("userServiceHelpers", () => {
    describe("signInGame", () => {
        const chance = new Chance();

        it("should return data from user service", async () => {
            // Arrange
            const userServiceUrl = "user-service-uri";
            const params = { session: chance.string(), username: chance.string(), browserUserAgent: chance.string() };
            const expectedValue = { data: "Post Result" };

            // Act
            const actualValue = await signInGame(userServiceUrl, params);

            // Assert

            expect(actualValue).toStrictEqual(expectedValue);
        });
    });
});
