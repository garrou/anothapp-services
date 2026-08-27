/**
 * @param {any[]} arr
 * @param {string} attribute
 * @returns {number[]}
 */
const cumulate = (arr, attribute) => {
    const result = new Array(arr.length + 1).fill(0);
    arr.forEach((s, i) => result[i+1] = result[i] + s[attribute]);
    return result;
}

const isDevMode = () => process.env.MODE === 'dev';

const isProdMode = () => !isDevMode();

const MONTHS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

/**
 * @param {number|string} month 1-12
 * @returns {string}
 */
const frenchMonth = (month) => MONTHS_FR[parseInt(month) - 1] ?? "";

export {
    cumulate,
    frenchMonth,
    isDevMode,
    isProdMode
}