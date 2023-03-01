const axios = require('axios');
const { PreviewShowDto } = require('../dto/show/preview');

const betaseries = 'https://api.betaseries.com';
const key = process.env.BETASERIES_KEY;

const getShowsImages = async (_, res) => {
    try {
        const resp = await axios.get(`${betaseries}/shows/discover?limit=8&key=${key}`);
        const { shows } = await resp.data;
        const previews = shows.map(s => new PreviewShowDto(s.id, s.title, s.images, s.length));

        res.status(200).json(previews);
    } catch (_) {
        res.status(500).json({ 'message': 'Une erreur est survenue' });
    }
}

module.exports = { getShowsImages };