const Season = require("../models/Season");
const seasonRepository = require("../repositories/seasonRepository");
const userSeasonRepository = require("../repositories/userSeasonRepository");

const deleteBySeasonId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await seasonRepository.deleteSeasonById(id);
        res.sendStatus(204);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getSeasonsByYear = async (req, res) => {
    try {
        const { year } = req.query;
        
        if (!year) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await userSeasonRepository.getSeasonsByAddedYear(req.user.id, year);
        res.status(200).json(rows.map(obj => new Season(obj)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = { deleteBySeasonId, getSeasonsByYear };
