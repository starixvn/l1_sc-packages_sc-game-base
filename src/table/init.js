const runGame = require("./run-game");

module.exports = (io, definition) => {
  const gameData = {
    roundId: 1,
    remainingTime: definition.durations.wholeRound,
    ingame: {},
    disabled: true,
    delayStartTime: 0,
    totalBets: definition.defaultTotalBets(),
    settlementResultFromAdmin: {},
  };

  definition.roundRepository
    .findOne({}, "id", { sort: { _id: -1 } })
    .lean()
    .then((lastRound) => {
      if (lastRound) {
        gameData.roundId = lastRound.id + 1;
      }
    });

  io[definition.name] = gameData;
  runGame(io, definition);
};
