const Logger = require("./../../../web/logger");

const queryHistory = async (definition, player, page, pageSize) => {
  const filter = { uid: player.UID, thanhtoan: true };
  const numberOfSkippedBets = (page - 1) * pageSize;
  const total = await definition.betRepository.countDocuments(filter).exec();
  const betProjection = {
    _id: false,
    uid: false,
    thanhtoan: false,
    odds: false,
    siteId: false,
    memberId: false,
    __v: false,
    __archive: false,
  };
  const bets = await definition.betRepository
    .find(filter, betProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
    .lean()
    .exec();
  let betLogs = [];

  if (bets && bets.length > 0) {
    betLogs = await Promise.all(
      bets.map(async (bet) => {
        const round = await definition.roundRepository
          .findOne({ id: bet.phien }, { _id: false, result: true, settlementResult: true })
          .lean()
          .exec();
        const betLogDetails = await definition.betLogRepository
          .find({ phien: bet.phien, uid: player.UID }, { _id: false, time: true, choice: true, amount: true }, { sort: { _id: -1 } })
          .lean()
          .exec();

        return { ...bet, result: round.result, settlementResult: round.settlementResult, betLogDetails };
      })
    );
  }

  player.red({ [definition.name]: { history: { betLogs, page, pageSize, total } } });
};

module.exports = (definition, player, payload) => {
  if (payload.page) {
    const page = payload.page >> 0;
    const pageSize = 8;

    if (page < 1) {
      return;
    }

    queryHistory(definition, player, page, pageSize).catch(Logger.logError);
  }
};
