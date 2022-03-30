import crypto from "crypto";

const randomString = (length = 21) => {
    return crypto.randomBytes(length).toString("hex").slice(0, length);
};

const createHashMD5 = (value) => {
    return crypto.createHash("md5").update(value).digest("hex");
};

export const generateMD5Result = (formattedResult, roundId) => {
    const formattedResultWithSalt = `${formattedResult}_{#${roundId}${randomString()}}`;
    return { hashValue: createHashMD5(formattedResultWithSalt), rawValue: formattedResultWithSalt };
};
