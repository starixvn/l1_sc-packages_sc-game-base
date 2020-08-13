const ConfigHelper = require("./../../../Helpers/ConfigHelper");

module.exports = (definition, player) => {
  const gameName = definition.name;
  const gameData = player.redT[gameName];
  const configs = ConfigHelper.getConfigs(definition.configName);
  const configuredlyDisabled = !configs || !configs.enabled;

  const disabled = configuredlyDisabled || gameData.delayStartTime > 0;
  const disabledMessage = configs ? configs.disabled_message : "";

  player.red({
    [gameName]: {
      remainingTime: gameData.remainingTime,
      um: disabled,
      um_message: disabledMessage,
    },
  });
};
