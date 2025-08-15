import { stub } from "jest-micro-auto-stub";
import { Issuer } from "openid-client";
import { logger } from "sc-common";

import BearerAuthenticator from "../bearer-authenticator";

jest.mock("sc-common");
jest.useFakeTimers();
jest.mock("openid-client", () => ({
    Issuer: {
        discover: jest.fn(),
    },
}));

describe("bearer authenticator test", () => {
    logger.log.mockReturnValue(jest.fn());
    logger.logError.mockReturnValue(jest.fn());

    const authConfigs = {
        url: "http://localhost",
        id: "client_id",
        secret: "client_secret",
    };
    /** @type {Issuer} */
    const issuer = stub(Issuer);
    issuer.Client.mockClear();
    Issuer.discover.mockReturnValue(issuer);

    const bearerAuthenticator = new BearerAuthenticator(authConfigs);

    describe("autoUpdateToken", () => {
        it("should calls updateToken", async () => {
            // arrange
            spyOn(bearerAuthenticator, "updateToken");
            spyOn(bearerAuthenticator, "refresh").and.returnValue(jest.fn());

            // act
            await bearerAuthenticator.autoUpdateToken();

            // assert
            expect(bearerAuthenticator.updateToken).toHaveBeenCalled();
        });

        it("should calls setTimeout", async () => {
            // arrange
            spyOn(bearerAuthenticator, "updateToken");
            spyOn(bearerAuthenticator, "refresh").and.returnValue(jest.fn());
            spyOn(global, "setTimeout");

            // act
            await bearerAuthenticator.autoUpdateToken();

            // assert
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
        });
    });

    describe("refresh", () => {
        it("should calls setTimeout", async () => {
            // arrange
            spyOn(bearerAuthenticator, "isTokenExpired").and.returnValue(false);
            spyOn(global, "setTimeout");

            // act
            await bearerAuthenticator.refresh();

            // assert
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
        });

        describe("when token expired", () => {
            it("should calls update token", async () => {
                // arrange
                spyOn(bearerAuthenticator, "isTokenExpired").and.returnValue(true);
                spyOn(bearerAuthenticator, "updateToken");

                // act
                await bearerAuthenticator.refresh();
                expect(bearerAuthenticator.updateToken).toHaveBeenCalled();
            });
        });
    });

    describe("updateToken", () => {
        describe("when normal", () => {
            it("should get bearer token", async () => {
                // arrange
                const token = {
                    token: "bearer_token",
                    expired: new Date(),
                };
                spyOn(bearerAuthenticator, "getBearerToken").and.returnValue(token);

                // act
                await bearerAuthenticator.updateToken();

                // assert
                expect(bearerAuthenticator.getBearerToken).toHaveBeenCalled();
                expect(bearerAuthenticator.token).toEqual(token.token);
                expect(bearerAuthenticator.expired).toEqual(token.expired);
                expect(logger.log).toHaveBeenCalledWith("Get bearer token successfully.");
            });
        });

        describe("when have exception", () => {
            it("should log error", async () => {
                // arrange
                spyOn(bearerAuthenticator, "getBearerToken").and.throwError("error");

                // act
                await bearerAuthenticator.updateToken();

                // assert
                expect(logger.logError).toHaveBeenCalled();
            });
        });
    });

    describe("isTokenExpired", () => {
        describe("when expired is null", () => {
            it("should returns true", () => {
                // arrange
                bearerAuthenticator.expired = null;

                // act & assert
                expect(bearerAuthenticator.isTokenExpired()).toBeTruthy();
            });
        });
        describe("when expired is undefined", () => {
            it("should returns true", () => {
                // arrange
                bearerAuthenticator.expired = undefined;

                // act & assert
                expect(bearerAuthenticator.isTokenExpired()).toBeTruthy();
            });
        });
    });
});
