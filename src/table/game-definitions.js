const GameIds = require("./../../../../../config/appConfigs").gameIds;

const ConfigHelper = require("./../../../../Helpers/ConfigHelper");

const Constants = require("../constants");
const generateResult = require("./../shuffleNumbers");
const SettlementRules = require("./../settlementRules");

const { KenoMax_phien, KenoMax_one, KenoMax_cuoc } = require("./models");

module.exports = {
  id: GameIds.kenomax,
  name: "kenoMax",
  configName: ConfigHelper.GameTypes.KenoMax,
  viewName: "viewKenoMax",
  durations: {
    wholeRound: 59,
    placingBets: 50,
    lockingBet: 5,
  },
  additionalValidationCriteria: [],
  choices: Constants.choices,
  queueingBet: false,
  defaultBetTracks: () => ({ ...Constants.defaultBetTracks }),
  defaultTotalBets: () => ({ ...Constants.defaultBetTracks }),
  generateResult: () => generateResult(20, 80),
  settle: SettlementRules.full,
  roundRepository: KenoMax_phien,
  betRepository: KenoMax_one,
  betLogRepository: KenoMax_cuoc,
};
