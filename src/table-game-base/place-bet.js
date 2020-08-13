const BalanceApi = require("./../../../apis/balanceApi");
const BetChoiceMapper = require("./../../../apis/betChoiceMapper");
const ConfigHelper = require("./../../..//Helpers/ConfigHelper");
const Logger = require("./../../../web/logger");

const NoticeMessages = require("./../constants/notice-messages");

const validateBetRequest = (definition, player, betChoice, amount) => {
  if (!amount || !betChoice) {
    return false;
  }

  const gameName = definition.name;
  const gameData = player.redT[gameName];
  const configs = ConfigHelper.getConfigs(definition.configName);
  const { betTracks } = gameData.ingame[player.profile.name] || { betTracks: {} };
  const totalAmount = definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
  const maxBetPerChoice = configs.choices_maxbet[betChoice] || 0;

  const defaultCriteria = [
    {
      failure: gameData.remainingTime < definition.durations.lockingBet || gameData.remainingTime >= definition.durations.placingBets,
      notice: NoticeMessages.placeBetNextRound,
    },
    {
      failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
      notice: NoticeMessages.maxBetForChoice(maxBetPerChoice),
    },
    {
      failure: amount < configs.minbet,
      notice: NoticeMessages.minBet(configs.minbet),
    },
    {
      failure: amount > configs.maxbet,
      notice: NoticeMessages.maxBet(configs.maxbet),
    },
    {
      failure: totalAmount > configs.maxbet,
      notice: NoticeMessages.maxBet(configs.maxbet),
    },
  ];

  const criteria = definition.additionalValidationCriteria
    ? definition.additionalValidationCriteria.concat(defaultCriteria)
    : defaultCriteria;
  const failedCriterion = criteria.find((criterion) => criterion.failure);

  if (failedCriterion) {
    player.red({ [gameName]: { notice: failedCriterion.notice, endBet: -1 } });

    return false;
  }

  return true;
};

const proceedBet = (definition, player, betChoice, amount) =>
  new Promise((resolve, reject) => {
    const gameName = definition.name;

    if (!player.redT || !player.redT[gameName]) {
      return;
    }

    const gameData = player.redT[gameName];
    const betInfo = {
      gameId: definition.id,
      gameRoundId: gameData.roundId,
      choiceId: BetChoiceMapper.convertKeno(betChoice),
      cuoc: amount,
      inSufficientBalance: { [gameName]: { notice: NoticeMessages.notEnoughMoney, endBet: -1 } },
    };
    const handleSuccessBetSync = ({ red }) =>
      handleSuccessBet(definition, player, gameData, red, betChoice, amount).then(resolve).catch(reject);
    const handleFailedBetSync = () => {
      player.red({ [gameName]: { endBet: -1 } });
      resolve();
    };

    BalanceApi.placeBet({ id: player.UID }, betInfo, player, handleSuccessBetSync, handleFailedBetSync);
  });

const handleSuccessBet = async (definition, player, gameData, red, betChoice, amount) => {
  const existingBetFilter = { uid: player.UID, phien: gameData.roundId };
  const existingBet = await definition.betRepository.findOne(existingBetFilter).exec();

  await insertBetLog(definition, player, gameData, betChoice, amount);

  if (existingBet) {
    existingBet[betChoice] += amount;
    await existingBet.save();
  } else {
    const configs = ConfigHelper.getConfigs(definition.configName);
    const newBet = {
      uid: player.UID,
      name: player.profile.name,
      phien: gameData.roundId,
      time: new Date(),
      odds: configs.odds,
    };
    const existingBetIncrement = { [betChoice]: amount };

    if (player.session) {
      newBet.memberId = player.session.memberId;
      newBet.siteId = player.session.siteId;
    }

    await definition.betRepository.updateOne(
      existingBetFilter,
      { $inc: existingBetIncrement, $setOnInsert: newBet },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  adjustBetTracks(gameData, player.profile.name, betChoice, amount);
  notifyPlacingBetResult(definition.name, player, gameData, red, betChoice, amount);
};

const insertBetLog = async (definition, player, gameData, betChoice, amount) => {
  const newBetLog = {
    uid: player.UID,
    name: player.profile.name,
    phien: gameData.roundId,
    time: new Date(),
    choice: betChoice,
    amount,
  };

  if (player.session) {
    newBetLog.memberId = player.session.memberId;
    newBetLog.siteId = player.session.siteId;
  }

  await definition.betLogRepository.create(newBetLog);
};

const adjustBetTracks = (gameData, playerName, betChoice, amount) => {
  if (gameData.ingame && gameData.ingame[playerName]) {
    const playerInGame = gameData.ingame[playerName];

    playerInGame.betTracks[betChoice] += amount;
  }
};

const notifyPlacingBetResult = (gameName, player, gameData, red, betChoice, amount) => {
  const name = player.profile.name;

  gameData.totalBets[betChoice] += amount;

  if (gameData.ingame && gameData.ingame[name]) {
    const playerInGame = gameData.ingame[name];
    const { betTracks: ownBets } = playerInGame;

    if (player.redT && player.redT.users) {
      player.redT.users[player.UID].forEach((player) => {
        player.red({
          [gameName]: { totalBets: gameData.totalBets, endBet: amount, ownBets },
          user: { red },
        });
      });
    }
  }
};

const placeBet = (definition, player, payload) => {
  const amount = payload.amount >> 0;
  const betChoice = payload.betChoice;

  if (!validateBetRequest(definition, player, betChoice, amount)) {
    return;
  }

  const name = player.profile.name;
  const gameData = player.redT[definition.name];

  if (!gameData.ingame[name]) {
    const newPlayer = {
      name: player.profile.name,
      betTracks: definition.defaultBetTracks(),
    };

    if (definition.queueingBet) {
      newPlayer.betQueue = [];
    }

    gameData.ingame[name] = newPlayer;
  }

  if (definition.queueingBet) {
    gameData.ingame[name].betQueue.push({ player, betChoice, amount });
  } else {
    proceedBet(definition, player, betChoice, amount).catch(Logger.logError);
  }
};

const dequeueBets = (io, definition) => {
  const gameName = definition.name;

  if (io[gameName].ingame) {
    Object.values(io[gameName].ingame).forEach((playerInGame) => {
      if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
        const { player, betChoice, amount } = playerInGame.betQueue.shift();

        playerInGame.betProcessing = true;
        proceedBet(definition, player, betChoice, amount)
          .then(() => (playerInGame.betProcessing = false))
          .catch(Logger.logError);
      }
    });
  }
};

const proceedBetQueue = (io, definition) => {
  const dequeueInterval = 50;
  const keepDequeuingBets = () => {
    dequeueBets(io, definition);
    setTimeout(keepDequeuingBets, dequeueInterval);
  };

  setTimeout(keepDequeuingBets, dequeueInterval);
};

module.exports = {
  placeBet,
  proceedBetQueue,
};
