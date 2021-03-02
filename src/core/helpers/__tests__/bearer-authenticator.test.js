import { stub } from "jest-micro-auto-stub";
import OpenIdClient, { Issuer } from "openid-client";
import { logger } from "sc-common";

import BearerAuthenticator from "../bearer-authenticator";

jest.mock("sc-common");
jest.useFakeTimers();
jest.mock("openid-client");

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
    OpenIdClient.Issuer.discover.mockReturnValue(issuer);

    const bearerAuthenticator = new BearerAuthenticator(authConfigs);

    it("autoUpdateToken_always_calls updateToken", async () => {
        // arrange
        spyOn(bearerAuthenticator, "updateToken");
        spyOn(bearerAuthenticator, "refresh").and.returnValue(jest.fn());

        // act
        await bearerAuthenticator.autoUpdateToken();

        // assert
        expect(bearerAuthenticator.updateToken).toHaveBeenCalled();
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    describe("refresh_", () => {
        it("always_calls setTimeout", async () => {
            // arrange
            spyOn(bearerAuthenticator, "isTokenExpired").and.returnValue(false);

            // act
            await bearerAuthenticator.refresh();

            // assert
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000);
        });

        it("token expired_calls update token", async () => {
            // arrange
            spyOn(bearerAuthenticator, "isTokenExpired").and.returnValue(true);
            spyOn(bearerAuthenticator, "updateToken");

            // act
            await bearerAuthenticator.refresh();
            expect(bearerAuthenticator.updateToken).toHaveBeenCalled();
        });
    });

    describe("updateToken_", () => {
        it("normal_get bearer token", async () => {
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

        it("have exception_log error", async () => {
            // arrange
            spyOn(bearerAuthenticator, "getBearerToken").and.throwError("error");

            // act
            await bearerAuthenticator.updateToken();

            // assert
            expect(logger.logError).toHaveBeenCalled();
        });
    });

    describe("isTokenExpired_", () => {
        it.each([undefined, null])("undefined/null expired_returns true", (value) => {
            // arrange
            bearerAuthenticator.expired = value;

            // act & assert
            expect(bearerAuthenticator.isTokenExpired()).toBeTruthy();
        });
    });
});
