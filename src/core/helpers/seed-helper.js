import crypto from "crypto";

function getMergeClientSeed(clientSeeds = []) {
    return "".concat(...clientSeeds.map((data) => data.clientSeed));
}

function getSHA256Hash(seed) {
    return crypto.createHash("sha256").update(seed).digest("hex");
}

function getSHA512Hash(seed) {
    return crypto.createHash("sha512").update(seed).digest("hex");
}

export { getMergeClientSeed, getSHA256Hash, getSHA512Hash };
