import { HttpRouter } from "../../../core/routers";
import TableGameData from "../../table-game-data";
import TableHttpRouter from "../table-http-router";

describe("table http router test", () => {
    const gameData = new TableGameData(0);
    const router = new TableHttpRouter({}, gameData);

    it("inherit HttpRouter", () => {
        expect(router instanceof HttpRouter);
    });

    it("collectOnlineUsers_always_calls super", () => {
        // arrange
        spyOn(HttpRouter.prototype, "collectOnlineUsers");
        gameData.players = {
            1: { name: "bot1", type: true, red: 1000 },
            2: { name: "bot2", type: true, red: 1000 },
        };

        // act
        router.collectOnlineUsers();

        // assert
        expect(HttpRouter.prototype.collectOnlineUsers).toHaveBeenCalled();
    });
});
