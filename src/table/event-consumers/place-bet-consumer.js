import { placeBet as placeBetApi } from "sc-base-apis";
import { helpers, logger } from "sc-common";
import { BaseEventPublisher } from "../../core/event-publishers/base-publisher";

export default class PlaceBetConsumer {  

    constructor(placeBetPublisher, choiceMapper, gameData, definition) {
        this.placeBetPublisher = placeBetPublisher ?? new BaseEventPublisher(gameData, definition.name);
        this.choiceMapper = choiceMapper;
    }

    validateBetRequest(definition, gameData, player, betChoice, amount) {
        if (!amount || !betChoice) {
            return false;
        }

        const gameName = definition.name;
        const configs = gameData.gameConfigs;
        const { betTracks } = gameData.ingame[player.profile.name] || { betTracks: {} };
        const totalAmount = definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const maxBetPerChoice = configs.choices_maxbet[betChoice] || 0;

        const defaultCriteria = [
            {
                failure:
                    gameData.remainingTime < definition.durations.lockingBet || gameData.remainingTime >= definition.durations.placingBets,
                notice: helpers.noticeHelper.placeBetNextRound,
            },
            {
                failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
                notice: helpers.noticeHelper.maxBetForChoice(maxBetPerChoice),
            },
            {
                failure: amount < configs.minbet,
                notice: helpers.noticeHelper.minBet(configs.minbet),
            },
            {
                failure: amount > configs.maxbet,
                notice: helpers.noticeHelper.maxBet(configs.maxbet),
            },
            {
                failure: totalAmount > configs.maxbet,
                notice: helpers.noticeHelper.maxBet(configs.maxbet),
            },
        ];

        const criteria = definition.additionalValidationCriteria
            ? definition.additionalValidationCriteria.concat(defaultCriteria)
            : defaultCriteria;
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            placeBetPublisher.publishGameFailedBet(player.UID, { [gameName]: { notice: failedCriterion.notice } });

            return false;
        }

        return true;
    }

    async placeBet(definition, player, payload, gameData) {
        const amount = payload.amount >> 0;
        const betChoice = payload.betChoice;

        if (!validateBetRequest(definition, gameData, player, betChoice, amount)) {
            return;
        }

        const name = player.profile.name;

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
            await proceedBet(definition, player, betChoice, amount, gameData, payload.freeBet).catch(logger.logError);
        }
    }

    async proceedBet(definition, player, betChoice, amount, gameData, freeBet) {
        const betInfo = {
            cuoc: amount,
            gameId: appConfigs.gameId,
            gameRoundId: gameData.roundId,
            choiceId: this.choiceMapper[betChoice],
            freeBet: freeBet,
        };

        const apiResult = await placeBetApi({ id: player.UID, session: player.session }, betInfo);

        if (apiResult.isOk) {
            await handleSuccessBet(definition, player, gameData, apiResult.response.red, betChoice, amount);
        } else {
            const notice = apiResult.response.inSufficientBalance ? helpers.noticeHelper.notEnoughMoney : apiResult.response;

            await handleFailedBet(player, gameData, betChoice, amount, notice);
        }
    }

    async handleSuccessBet(definition, player, gameData, red, betChoice, amount) {
        const existingBetFilter = { uid: player.UID, phien: gameData.roundId };
        const existingBet = await definition.betRepository.findOne(existingBetFilter).exec();

        if (definition.betLogRepository) {
            await insertBetLog(definition.betLogRepository, player, gameData.roundId, betChoice, amount);
        }

        if (existingBet) {
            existingBet[betChoice] += amount;
            await existingBet.save();
        } else {
            const configs = gameData.gameConfigs;
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
    }

    handleFailedBet(player, gameData, betChoice, betAmount, notice) {
        this.adjustBetTracks(gameData, player.profile.name, betChoice, -betAmount);

        if (notice.apiError) {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, kickedOut: notice.kickedOut });
        } else {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice });
        }
    }

    async insertBetLog(betLogRepository, player, roundId, betChoice, amount) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
            time: new Date(),
            choice: betChoice,
            amount,
        };

        if (player.session) {
            newBetLog.memberId = player.session.memberId;
            newBetLog.siteId = player.session.siteId;
        }

        await betLogRepository.create(newBetLog);
    }

    adjustBetTracks(gameData, playerName, betChoice, amount) {
        if (gameData.ingame && gameData.ingame[playerName]) {
            const playerInGame = gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] += amount;
        }
    }

    notifyPlacingBetResult(gameName, player, gameData, red, betChoice, amount) {
        const result = this.generatePlacingBetResult(gameName, gameData, player, red, betChoice, amount);
        this.placeBetPublisher.publishSuccessBet(result);
    }

    generatePlacingBetResult(gameName, gameData, player, userBalance, betChoice, betAmount) {
        gameData.totalBets[betChoice] += betAmount;

        if (gameData.players[player.UID]) {
            gameData.players[player.UID].red = userBalance;
        }

        const betsOfThisUser = gameData.ingame[player.profile.name];
        const ownBets = constants.choices.reduce((result, choice) => {
            result[choice] = betsOfThisUser[choice];
            return result;
        }, {});

        const successMessage = {
            [gameName]: { ownChip: { box: betChoice, bet: betAmount }, ownBets: ownBets, endBet: betAmount },
            user: { red: userBalance },
        };

        return successMessage;
    }

    dequeueBets(definition, gameData) {
        if (gameData.ingame) {
            Object.values(gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, betChoice, amount } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    proceedBet(definition, player, betChoice, amount)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(logger.logError);
                }
            });
        }
    }

    proceedBetQueue(definition, gameData) {
        const dequeueInterval = 50;
        const keepDequeuingBets = () => {
            dequeueBets(definition, gameData);
            setTimeout(keepDequeuingBets, dequeueInterval);
        };

        setTimeout(keepDequeuingBets, dequeueInterval);
    }
}
