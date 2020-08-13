const getTime = require("./get-time");
const { placeBet } = require("./place-bet");
const getLogs = require("./get-logs");
const getHistory = require("./get-history");
const getGameConfigs = require("./get-game-configs");

module.exports = (definition, player, payload) => {
  if (payload.view) {
    player.gameEvent.viewMiniSedie = !!payload.view;
  }

  if (payload.get_time) {
    getTime(definition, player);
  }

  if (payload.bet) {
    placeBet(definition, player, payload.bet);
  }

  if (payload.getLogs) {
    getLogs(definition, player);
  }

  if (payload.getHistory) {
    getHistory(definition, player, payload.getHistory);
  }

  if (payload.getGameConfigs) {
    getGameConfigs(definition, player);
  }
};
