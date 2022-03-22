import { generateMD5Result } from "../helpers/md5-helper";
import { encrypt, decrypt } from "../helpers/crypto-helper";

export default class RoundResultConsumer {
    constructor(gameData, definition, roundResultPublisher, md5sRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.md5sRepository = md5sRepository;
    }

    async generateResultAndPublishMD5(lastMD5Record) {
        if (!this.md5sRepository) {
            return;
        }

        if (lastMD5Record && lastMD5Record.roundId === this.gameData.roundId) {
            this.gameData.result = JSON.parse(decrypt(lastMD5Record.encryptedResult));
            this.gameData.md5 = JSON.parse(decrypt(lastMD5Record.encryptedMD5));
        } else {
            this.gameData.result = this.generateResult();
            this.gameData.md5 = this.buildMD5();
            await this.createMD5Record();
        }

        this.roundResultPublisher.publishMD5();
    }

    generateResult() {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin;
        return this.gameData.roundId === resultFromAdmin.roundId ? resultFromAdmin.result : this.definition.generateResult();
    }

    buildMD5() {
        const formattedResult = this.definition.generateRawResultForMd5(this.gameData.result);
        return { ...generateMD5Result(formattedResult, this.gameData.roundId), roundId: this.gameData.roundId };
    }

    async createMD5Record() {
        await this.md5sRepository.create({
            roundId: this.gameData.roundId,
            encryptedMD5: encrypt(JSON.stringify(this.gameData.md5)),
            encryptedResult: encrypt(JSON.stringify(this.gameData.result)),
            time: this.getNewDate(),
        });
    }

    getNewDate() {
        return new Date();
    }
}
