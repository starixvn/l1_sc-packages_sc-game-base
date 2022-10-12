export const getCurrentTime = () => {
    return new Date();
};

export const getDateTimeStringAtGMT7 = (date) => {
    return date?.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", timeZoneName: "short" });
};
