export default class AchievementTier {

    /**
     * @param {Object} row
     */
    constructor(row) {
        this.code = row.code;
        this.league = row.league;
        this.subTier = row["subTier"] ?? row["sub_tier"];
        this.threshold = parseFloat(row.threshold);
    }
}
