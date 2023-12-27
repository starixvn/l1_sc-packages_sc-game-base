export const gameManagementClient = jest.fn(() => ({
    users: {
        updateBalance: jest.fn().mockReturnValue({ catch: jest.fn() }),
        getDisableBots: jest.fn(),
        updateBotsOutRoom: jest.fn(),
        updateBotsJoinRoom: jest.fn(),
        resetBotsInRoom: jest.fn(),
        getAllBots: jest.fn(),
        getTotalBots: jest.fn(),
        updateUserStakeLevel: jest.fn().mockReturnValue({ catch: jest.fn() }),
        getUserScoins: jest.fn(),
        setBalanceAndDecreaseScoins: jest.fn().mockReturnValue({ catch: jest.fn() }),
        getUserInfo: jest.fn(),
        setBalance: jest.fn(),
    },
    gameConfigs: {
        getGameConfigs: jest.fn(),
        updateDisabledround: jest.fn(),
        updateExchangeReload: jest.fn(),
    },
    notification: {
        getUmMessages: jest.fn(),
    },
    promotion: {
        getPromotions: jest.fn(),
    },
    exchangeRates: {
        getExchangeRates: jest.fn(),
    },
    operatorConfig: {
        getGameSiteExclusions: jest.fn(),
    },
    currencyGroups: {
        getCurrencyGroups: jest.fn(),
    },
    currencies: {
        getCurrencies: jest.fn(),
    },
    currencyGroupGames: {
        getCurrencyGroupGamesByGameId: jest.fn(),
    },
    archiveStatus: {
        getArchiveStatus: jest.fn(),
    },
    aggregation: {
        getSettingForNewRound: jest.fn(),
    },
}));
