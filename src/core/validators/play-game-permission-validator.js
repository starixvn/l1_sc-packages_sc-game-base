import GameDefinition from "../game-definition";

export class PlayGamePermissionValidator {
    /**
     * @param {GameDefinition} definition
     * @param {mongoose.Model} currencyGroupGamesRepository
     */
    constructor(definition, currencyGroupGamesRepository, userSignInPublisher) {
        this.definition = definition;
        this.currencyGroupGamesRepository = currencyGroupGamesRepository;
        this.userSignInPublisher = userSignInPublisher;
    }

    async validate(userSession, socketClient) {
        const offeredGames = await this.getOfferedGames(userSession.currencyGroupId);

        if (!offeredGames || !offeredGames.includes(this.definition.id)) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(socketClient, this.definition.id);
            return false;
        }

        return true;
    }

    async getOfferedGames(currencyGroupId) {
        return this.currencyGroupGamesRepository.distinct("gameId", { groupId: currencyGroupId }).exec();
    }
}
