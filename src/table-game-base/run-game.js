const CronJob = require("cron").CronJob;

const BalanceApi = require("./../../../apis/balanceApi");
const ConfigHelper = require("./../../../Helpers/ConfigHelper");
const GameConfigs = require("./../../../Models/GameConfig/GameConfigs");
const Logger = require("./../../../web/logger");

const runGame = (io, definition) => {
  const job = new CronJob(
    "* * * * * *",
    () => proceed(io, definition).catch(Logger.logError),
    () => {
      Logger.logError(`${definition.name} unexpectedly stopped because the calculated time of the next interval was negative.`);
      job.start();
    },
    true
  );
};

const proceed = async (io, definition) => {
  const gameData = io[definition.name];

  if (gameData.remainingTime === definition.durations.wholeRound) {
    await checkGameStatus(io, definition);
  }

  if (!gameData.disabled) {
    gameData.remainingTime--;
  }

  if (gameData.remainingTime === definition.durations.placingBets) {
    resetForNewRound(definition, gameData);
    definition.bot && (await definition.bot.reset());
  }

  if (gameData.remainingTime < 0) {
    gameData.remainingTime = definition.durations.wholeRound;
    await settleRound(io, definition);
  } else if (gameData.remainingTime < definition.durations.placingBets) {
    definition.bot && definition.bot.run(gameData);
    pushRunningRoundInfoToAllRealPlayers(io, definition);
  }
};

const checkGameStatus = async (io, definition) => {
  const gameName = definition.name;
  const viewName = definition.viewName;
  const gameConfigName = definition.configName;
  const gameData = io[gameName];
  const gameConfigs = await GameConfigs.findOne({ name: gameConfigName }).lean().exec();
  const configuredlyDisabled = !gameConfigs || !gameConfigs.enabled;
  const previouslyDisabled = gameData.disabled;

  ConfigHelper.updateConfig(gameConfigName, gameConfigs);

  if (gameData.disabled) {
    if (gameData.delayStartTime > 0) {
      gameData.delayStartTime--;
    } else if (!configuredlyDisabled) {
      gameData.delayStartTime = gameConfigs && gameConfigs.delayStartTime ? gameConfigs.delayStartTime : 0;
    }
  }

  gameData.disabled = configuredlyDisabled || gameData.delayStartTime > 0;

  if (gameData.disabled) {
    const disabledMessage = gameConfigs ? gameConfigs.disabled_message : "";
    const payload = { [gameName]: { um: true, um_message: disabledMessage } };

    gameData.remainingTime = definition.durations.wholeRound;

    io.sendAllUser(payload);
    io.sendAllAdmin(payload, viewName);

    if (!previouslyDisabled) {
      await GameConfigs.updateOne({ name: gameConfigName }, { disabledround: gameData.roundId });
    }
  } else if (previouslyDisabled) {
    io.sendAllUser({
      [gameName]: {
        remainingTime: gameData.remainingTime,
        gameConfigs: {
          minbet: gameConfigs.minbet,
          maxbet: gameConfigs.maxbet,
          choices_maxbet: gameConfigs.choices_maxbet,
          odds: gameConfigs.odds,
        },
      },
    });
    io.sendAllAdmin({ [gameName]: { remainingTime: gameData.remainingTime, roundId: gameData.roundId } }, viewName);
  } else {
    io.sendAllUser({ [gameName]: { remainingTime: gameData.remainingTime } });
  }
};

const resetForNewRound = (definition, gameData) => {
  gameData.ingame = {};
  gameData.totalBets = definition.defaultTotalBets();
};

const settleRound = async (io, definition) => {
  const gameData = io[definition.name];
  const resultFromAdmin = gameData.settlementResultFromAdmin;
  const result = gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : definition.generateResult();
  const settlementResult = definition.settle(result);
  const newRound = await definition.roundRepository.create({
    result,
    settlementResult,
    time: new Date(),
  });

  if (newRound) {
    const finish = {
      settlementResult,
      result,
      roundId: newRound.id,
      time: newRound.time,
    };

    gameData.roundId = finish.roundId + 1;

    await settleBets(io, definition, finish);
  }
};

const settleBets = async (io, definition, finish) => {
  const bets = await definition.betRepository.find({ phien: finish.roundId }).exec();

  if (bets && bets.length > 0) {
    await Promise.all(
      bets.map(async (bet) => {
        const betResult = calculateBetResult(finish, bet);

        bet.betwin = betResult.totalWin;
        bet.thanhtoan = true;

        await bet.save();
        notifyBetResult(io, definition, bet.uid, betResult);
        callEndGame(definition, bet, finish, betResult, io.users);
      })
    );
  }

  pushRoundResultToAllRealPlayers(io, definition, finish);
};

const calculateBetResult = (finish, bet) => {
  const betResult = Object.entries(finish.settlementResult).reduce(
    (result, [choice, win]) => {
      const betAmount = bet[choice];
      const winAmount = win ? betAmount * bet.odds[choice] : 0;

      result.totalBetAmount += betAmount;
      result.totalWin += winAmount;
      result.winningByChoices[choice] = winAmount;

      if (winAmount > 0) {
        result.netWin += winAmount - betAmount;
      } else {
        result.totalLost += betAmount;
      }

      return result;
    },
    {
      totalBetAmount: 0,
      totalWin: 0,
      netWin: 0,
      totalLost: 0,
      winningByChoices: {},
    }
  );

  betResult.totalWin = parseFloat(betResult.totalWin.toFixed(2));
  betResult.netWin = parseFloat(betResult.netWin.toFixed(2));

  return betResult;
};

const callEndGame = (definition, bet, finish, betResult, users) => {
  const gameInfo = {
    gameId: definition.id,
    gameRoundId: finish.roundId,
    memberId: bet.memberId,
    siteId: bet.siteId,
    time: finish.time,
  };
  const settlementInfo = {
    redPlay: betResult.totalBetAmount,
  };

  if (betResult.totalWin > 0) {
    settlementInfo.red = betResult.totalWin;
  }

  if (betResult.netWin > 0) {
    settlementInfo.redWin = betResult.netWin;
  }

  if (betResult.totalLost > 0) {
    settlementInfo.redLost = betResult.totalLost;
  }

  BalanceApi.endGame(bet.uid, gameInfo, settlementInfo, users);
};

const pushRunningRoundInfoToAllRealPlayers = (io, definition) => {
  const gameName = definition.name;
  const viewName = definition.viewName;
  const gameData = io[gameName];
  const adminData = {
    [gameName]: {
      totalBets: gameData.totalBets,
      ingame: gameData.ingame,
    },
  };

  Object.values(io.users).forEach((players) => {
    players.forEach((player) => {
      if (player.gameEvent && player.gameEvent[viewName]) {
        player.red({ [gameName]: { totalBets: gameData.totalBets } });
      }
    });
  });

  Object.values(io.admins).forEach((admin) => {
    admin.forEach((client) => {
      if (client.gameEvent && client.gameEvent[viewName]) {
        client.red(adminData);
      }
    });
  });
};

const pushRoundResultToAllRealPlayers = (io, definition, finish) => {
  const gameName = definition.name;
  const viewName = definition.viewName;

  io.sendAllUser({
    [gameName]: {
      finish: {
        roundId: finish.roundId,
        result: finish.result,
        settlementResult: finish.settlementResult,
      },
    },
  });

  io.sendAllAdmin({ [gameName]: { finish } }, viewName);
};

const notifyBetResult = (io, definition, uid, betResult) => {
  if (!io.users[uid]) {
    return;
  }

  const gameName = definition.name;
  const status = { winningByChoices: betResult.winningByChoices };

  if (betResult.totalWin > 0) {
    status.win = true;
    status.bet = betResult.totalWin;
  } else {
    status.win = false;
    status.bet = betResult.totalLost;
  }

  io.users[uid].forEach((user) => {
    user.red({ [gameName]: { status: status } });
  });
};

module.exports = runGame;
