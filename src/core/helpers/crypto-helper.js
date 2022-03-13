import crypto from "crypto";

export const randomString = (length = 26) => {
    return crypto
        .randomBytes(length)
        .toString("hex")
        .slice(0, length - 1);
};

export const createHashMD5 = (value) => {
    return crypto.createHash("md5").update(value).digest("hex");
};
