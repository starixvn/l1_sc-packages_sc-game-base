import { generateMD5Result } from "../helpers/md5-helper";
import { encrypt, decrypt } from "../helpers/crypto-helper";

export default class RoundResultConsumer {
    constructor(gameData, definition, roundResultPublisher, resultRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultRepository = resultRepository;
    }

    async generateResultAndPublishHash(lastResultRecord) {
        if (!this.resultRepository) {
            return;
        }

        if (lastResultRecord && lastResultRecord.roundId === this.gameData.roundId) {
            this.gameData.result = JSON.parse(decrypt(lastResultRecord.encryptedResult));
            this.gameData.resultHash = JSON.parse(decrypt(lastResultRecord.encryptedResultHash));
        } else {
            this.gameData.result = this.generateResult();
            this.gameData.resultHash = this.buildResultHash();
            await this.createResultRecord();
        }

        this.roundResultPublisher.publishResultHash();
    }

    generateResult() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;
        return this.gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : this.definition.generateResult();
    }

    buildResultHash() {
        const formattedResult = this.definition.generateRawResultForHash(this.gameData.result);
        return { ...generateMD5Result(formattedResult, this.gameData.roundId), roundId: this.gameData.roundId };
    }

    async createResultRecord() {
        await this.resultRepository.create({
            roundId: this.gameData.roundId,
            encryptedResultHash: encrypt(JSON.stringify(this.gameData.resultHash)),
            encryptedResult: encrypt(JSON.stringify(this.gameData.result)),
            time: this.getNewDate(),
        });
    }

    getNewDate() {
        return new Date();
    }
}
