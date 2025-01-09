export default class ParserHelper {

    /**
     * @param {string?} toParse
     * @param {string} delimiter
     * @returns {number[]}
     */
    static splitAndToNumber = (toParse, delimiter = ",") => {
        return toParse?.split(delimiter).reduce((acc, curr) => {
            const num = parseInt(curr);

            if (!isNaN(num)) {
                acc.push(num);
            }
            return acc;
        }, []) ?? [];
    }

    /**
     * @param {string} toParse
     * @param {string} delimiter
     * @returns {string[]}
     */
    static splitAndToNotNull = (toParse, delimiter = ",") => {
        return toParse?.split(delimiter).filter((val) => !!val) ?? [];
    }
}