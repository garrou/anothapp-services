import axios from "axios";

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * @param {string} message
 * @returns {string}
 */
const shorten = (message) => {
    if (message.length <= TELEGRAM_MAX_LENGTH) {
        return message;
    }
    const summary = message.split("\n").filter((line) => !line.startsWith("    ")).join("\n");
    return summary.length <= TELEGRAM_MAX_LENGTH ? summary : `${summary.slice(0, TELEGRAM_MAX_LENGTH - 1)}…`;
};

/**
 * @param {string} message
 * @returns {Promise<void>}
 */
const sendTelegramMessage = async (message) => {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn("TELEGRAM_TOKEN / TELEGRAM_CHAT_ID non configurés, notification ignorée");
        return;
    }
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: shorten(message),
        });
    } catch (error) {
        console.error("Échec de l'envoi de la notification Telegram", error.response?.data ?? error.message);
    }
};

export default sendTelegramMessage;
export {shorten};
