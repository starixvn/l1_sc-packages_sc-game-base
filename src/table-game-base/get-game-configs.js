const ConfigHelper = require("./../../../Helpers/ConfigHelper");

module.exports = (definition, player) => {
  const configs = ConfigHelper.getConfigs(definition.configName);
  const gameConfigs = {
    minbet: configs.minbet,
    maxbet: configs.maxbet,
    choices_maxbet: configs.choices_maxbet,
    odds: configs.odds,
  };

  player.red({ [definition.name]: { gameConfigs } });
};
