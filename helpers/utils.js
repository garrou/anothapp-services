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

/**
 * @param {string} currentUserId
 * @param {string?} requestedId
 * @returns {boolean}
 */
const isOwnRequest = (currentUserId, requestedId) => !requestedId || requestedId === currentUserId;

const EMAIL_PATTERN_LOG = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Strips anything that looks like an email address from an error before it's logged - SMTP
 * rejection errors (nodemailer) commonly echo the bounced recipient's address in their message
 * or response text, which must not end up verbatim in production logs.
 * @param {unknown} err
 * @returns {string}
 */
const sanitizeErrorForLog = (err) => String(err?.message ?? err).replace(EMAIL_PATTERN_LOG, "[email]");

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
    isOwnRequest,
    isProdMode,
    sanitizeErrorForLog
}
