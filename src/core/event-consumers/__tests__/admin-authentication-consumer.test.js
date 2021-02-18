import { stub } from "jest-micro-auto-stub";
import { utils } from "sc-common";

import { AdminPublisher } from "../../event-publishers";
import GameData from "../../game-data";
import AdminAuthenticationConsumer from "../admin-authentication-consumer";

jest.mock("sc-common");

describe("admin authentication consumer test", () => {
    const gameData = new GameData(0);
    const adminSecretKey = "adminSecretKey";

    /** @type {AdminPublisher}*/
    const adminPublisher = stub(AdminPublisher);
    const consumer = new AdminAuthenticationConsumer(gameData, adminSecretKey, adminPublisher);

    utils.authentication.adminAuthenticate.mockReturnValue();

    describe("consume_", () => {
        const socketClient = {
            id: "socket-id",
            emit: jest.fn(),
        };
        const token = "token";

        it("authenticate failed_publish unauthorized message", () => {
            // arrange
            utils.authentication.adminAuthenticate.mockReturnValue(false);
            spyOn(adminPublisher, "publishUnauthorizedMessage");

            // act
            consumer.consume(socketClient, token);

            // assert
            expect(adminPublisher.publishUnauthorizedMessage).toHaveBeenCalledWith(socketClient);
        });

        it("authenticate passed_publish authorized message", () => {
            // arrange
            utils.authentication.adminAuthenticate.mockReturnValue(true);
            spyOn(adminPublisher, "publishAuthorizedMessage");

            // act
            consumer.consume(socketClient, token);

            // assert
            expect(adminPublisher.publishAuthorizedMessage).toHaveBeenCalledWith(socketClient);
        });
    });
});
