import Chance from "chance";
import { verifySession, signInGame } from "../user-service-helpers";

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
    describe("verifySession", () => {
        const chance = new Chance();

        it("should return data from user service", async () => {
            // Arrange
            const userServiceSettings = { url: "user-service-uri", requestTimeout: 50000 };
            const params = { session: chance.string(), username: chance.string(), browserUserAgent: chance.string() };
            const expectedValue = "Post Result";

            // Act
            const actualValue = await verifySession(userServiceSettings, params);

            // Assert

            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

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
