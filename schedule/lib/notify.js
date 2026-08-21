import axios from "axios";

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
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: message,
    });
};

export default sendTelegramMessage;
