import { HttpRouter } from "./../../core/routers/";

export default class TableHttpRouter extends HttpRouter {
    collectOnlineUsers() {
        const realOnlineUsers = super.collectOnlineUsers();
        const bots = Object.values(this.gameData.players)
            .filter((player) => player.type || player.patternId > 0)
            .map((bot) => ({ name: bot.name, red: bot.red }));

        return {
            ...realOnlineUsers,
            bots,
            totalBots: bots.length,
        };
    }
}
