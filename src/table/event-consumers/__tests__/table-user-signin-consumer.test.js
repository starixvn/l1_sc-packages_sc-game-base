import "jest-extended";

import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import socketIO from "socket.io";

import UserSignInConsumer from "../../../core/event-consumers/user-signin-consumer";
import TableUserSignInPublisher from "../../event-publishers/table-user-signin-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableUserSignInConsumer from "../table-user-signin-consumer";

describe("table user signin consumer in testing", () => {
    /** @type {TableUserSignInPublisher}*/
    const userSignInPublisher = stub(TableUserSignInPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongooseModelStupidly(mongoose.Model);
    const definition = new TableGameDefinition({ name: "game name" });

    /** @type {socketIO.Socket} */
    const socketClient = stub(socketIO.Socket);

    let gameData;
    let consumer;
    beforeEach(() => {
        gameData = new TableGameData(0);

        consumer = new TableUserSignInConsumer(definition, gameData, userSignInPublisher, userInfosRepository, userSessionsRepository);
    });

    it("Inherit UserSignInConsumer", () => {
        expect(consumer instanceof UserSignInConsumer).toBeTruthy();
    });

    describe("consume", () => {
        it("disabled_publish UM Notice", () => {
            // arrange
            gameData.gameConfigs = { enabled: false, disabled_message: "disabled message" };

            // act
            consumer.consume(socketClient, {});

            // assert
            expect(userSignInPublisher.publishUmNotice).toHaveBeenCalled();
        });

        it("enabled_calls super.consume", () => {
            // arrange
            spyOn(UserSignInConsumer.prototype, "consume");
            gameData.gameConfigs = { enabled: true };

            // act
            consumer.consume(socketClient, {});

            // assert
            expect(UserSignInConsumer.prototype.consume).toHaveBeenCalled();
        });
    });

    it("handleSignInSuccess_Always_Specific Methods", () => {
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
        expect(userSignInPublisher.publishToGameMessage).toHaveBeenCalled();
    });
});
