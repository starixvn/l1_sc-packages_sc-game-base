import "jest-extended";
import { stub } from "jest-micro-auto-stub";
import { Socket } from "socket.io";

import UserSignInConsumer from "../../../core/event-consumers/user-signin-consumer";
import { PlayGamePermissionValidator } from "../../../core/validators";
import TableUserSignInPublisher from "../../event-publishers/table-user-signin-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableUserSignInConsumer from "../table-user-signin-consumer";
import GameManagementApiClientFactory from "../../../core/game-management-api";

jest.mock("sc-game-management-client");

describe("table user signin consumer in testing", () => {
    /** @type {TableUserSignInPublisher}*/
    const userSignInPublisher = stub(TableUserSignInPublisher);

    const definition = new TableGameDefinition({ name: "game name" });

    /** @type {PlayGamePermissionValidator}*/
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    /** @type {Socket} */
    const socketClient = stub(Socket);
    
    const gameManagementApiClientFactory = {
        instance: jest.fn().mockReturnValue({})
    };

    let gameData;
    let consumer;
    let config;
    
    beforeEach(() => {
        gameData = new TableGameData(0);

        config = {
            playGamePermissionValidator,
            appConfigs: null,
            gameManagementApiClientFactory,
            logService: null,
            gamePromotionApiClient: null
        };

        consumer = new TableUserSignInConsumer({
            definition,
            gameData,
            userSignInPublisher,
            playGamePermissionValidator,
            appConfigs: null,
            gameManagementApiClientFactory,
            logService: null,
            gamePromotionApiClient: null
        });
    });

    it("Inherit UserSignInConsumer", () => {
        expect(consumer instanceof UserSignInConsumer).toBeTruthy();
    });

    describe("consume", () => {
        describe("when disabled", () => {
            it("should publish UM Notice", () => {
                // arrange
                gameData.gameConfigs = { enabled: false, disabled_message: "disabled message" };

                // act
                consumer.consume(socketClient, {});

                // assert
                expect(userSignInPublisher.publishUmNotice).toHaveBeenCalled();
            });
        });

        describe("when enabled", () => {
            it("should calls super.consume", () => {
                // arrange
                spyOn(UserSignInConsumer.prototype, "consume");
                gameData.gameConfigs = { enabled: true };

                // act
                consumer.consume(socketClient, {});

                // assert
                expect(UserSignInConsumer.prototype.consume).toHaveBeenCalled();
            });
        });
    });

    describe("handleSignInSuccess", () => {
        it("should call handleSignInSuccess", () => {
            // arrange
            spyOn(UserSignInConsumer.prototype, "handleSignInSuccess");
            const storedSession = {
                userId: "valid user ID",
                username: "username",
                browserUserAgent: "chrome",
            };
            const storedUserInfo = { name: "hello worlld" };

            // act
            consumer.handleSignInSuccess(socketClient, storedUserInfo, storedSession);

            // assert
            expect(UserSignInConsumer.prototype.handleSignInSuccess).toHaveBeenCalled();
        });

        it("should call publishToGameMessage", () => {
            // arrange
            spyOn(UserSignInConsumer.prototype, "handleSignInSuccess");
            const storedSession = {
                userId: "valid user ID",
                username: "username",
                browserUserAgent: "chrome",
            };
            const storedUserInfo = { name: "hello worlld" };

            // act
            consumer.handleSignInSuccess(socketClient, storedUserInfo, storedSession);

            // assert
            expect(userSignInPublisher.publishToGameMessage).toHaveBeenCalled();
        });
    });
});
