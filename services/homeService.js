const axios = require("axios");
const betaseries = "https://api.betaseries.com";
const key = process.env.BETASERIES_KEY;
const ApiShowPreview = require("../models/ApiShowPreview");

const getShowsImages = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/discover?limit=8`, {
            headers: {
                "X-BetaSeries-Key": key
            }
        });
        const { shows } = await resp.data;
        res.status(200).json(shows.map(show => new ApiShowPreview(show)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = { getShowsImages };