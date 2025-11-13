import { getCurrentTime, getDateTimeStringAtGMT7 } from "./time-helper";

export const getEffectivePromotion = (promotions) => {
    const promotionPeriods = [];
    promotions.forEach((promotion) => {
        if (promotion.isDaily) {
            const tmpStartTime = new Date(promotion.startDateTime);
            const tmpEndTime = new Date(promotion.endDateTime);
            tmpEndTime.setDate(promotion.startDateTime.getDate());
            tmpEndTime.setMonth(promotion.startDateTime.getMonth());
            tmpEndTime.setFullYear(promotion.startDateTime.getFullYear());
            if (tmpEndTime < promotion.startDateTime) {
                tmpEndTime.setDate(tmpEndTime.getDate() + 1);
            }

            while (tmpEndTime <= promotion.endDateTime) {
                promotionPeriods.push({ start: new Date(tmpStartTime), end: new Date(tmpEndTime), promotion });
                tmpStartTime.setDate(tmpStartTime.getDate() + 1);
                tmpEndTime.setDate(tmpEndTime.getDate() + 1);
            }
        } else {
            promotionPeriods.push({ start: promotion.startDateTime, end: promotion.endDateTime, promotion });
        }
    });

    const currentTime = getCurrentTime();
    const effectivePromotion = promotionPeriods.find((p) => p.start <= currentTime && p.end >= currentTime);

    return effectivePromotion?.promotion;
};

export const getStartPromotionMessage = (gameName, promotion) => {
    return `Started to apply boosted odds for game {{BeginBold}}${gameName}{{EndBold}}
    {{NewLine}}{{BeginBold}}Boosted Odds{{EndBold}}: ${JSON.stringify(promotion?.odds)}
    {{NewLine}}{{BeginBold}}From{{EndBold}}: ${getDateTimeStringAtGMT7(promotion?.startDateTime)} 
    {{NewLine}}{{BeginBold}}To{{EndBold}}      : ${getDateTimeStringAtGMT7(promotion?.endDateTime)} `;
};

export const getFinishPromotionMessage = (gameName, promotion, originalOdds) => {
    return `Finish applying boosted odds for game {{BeginBold}}${gameName}{{EndBold}} 
    {{NewLine}}{{BeginBold}}Original Odds{{EndBold}}: ${JSON.stringify(originalOdds)}
    {{NewLine}}{{BeginBold}}From{{EndBold}}: ${getDateTimeStringAtGMT7(promotion?.startDateTime)}
    {{NewLine}}{{BeginBold}}To{{EndBold}}      : ${getDateTimeStringAtGMT7(promotion?.endDateTime)} `;
};

export const validatePromotionAvailable = (promotions, gameId) => {
    if (!promotions?.length) {
        return null;
    }
    const validPromotion = promotions.find((promotion) => promotion.gameIds?.includes(gameId));
    if (!validPromotion) {
        return null;
    }
    return {
        promotionId: validPromotion._id,
        remainingBonusItems: validPromotion.bonusItemCount,
        isActive: true,
        endDate: validPromotion.endDate,
        isGiftCode: validPromotion.isGiftCode,
        isClaimed: false,
    };
};
