function getDueDate(reviewedAt, confidence) {
    if (!reviewedAt || isNaN(new Date(reviewedAt).getTime())) {
        console.error("Invalid reviewedAt:", reviewedAt);
        return new Date(); // fallback to now
    }

    if (confidence <= 0) {
        return new Date();
    }

    let daysToAdd;

    if (confidence > 8) {
        const i = confidence - 8;
        daysToAdd = 45 + 15 * i;
    }

    switch (confidence) {
        case 1: daysToAdd = 0; break;
        case 2: daysToAdd = 1; break;
        case 3: daysToAdd = 3; break;
        case 4: daysToAdd = 7; break;
        case 5: daysToAdd = 14; break;
        case 6: daysToAdd = 21; break;
        case 7: daysToAdd = 30; break;
        case 8: daysToAdd = 45; break;
        default: if (!daysToAdd) daysToAdd = 1;
    }

    const result = new Date(reviewedAt);
    result.setDate(result.getDate() + daysToAdd);
    return result;
}



module.exports = getDueDate;