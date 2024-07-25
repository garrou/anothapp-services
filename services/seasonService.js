const Season = require("../models/Season");
const SeasonTimeline = require("../models/SeasonTimeline");
const seasonRepository = require("../repositories/seasonRepository");
const userSeasonRepository = require("../repositories/userSeasonRepository");

const MONTHS = ["0", "1", "2", "3", "6", "12", "120"];

const deleteBySeasonId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await seasonRepository.deleteSeasonById(id, req.user.id);
        res.status(200).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getSeasons = async (req, res) => {
    try {
        const { year, month } = req.query;
        let response = null;

        if (MONTHS.includes(month)) {
            response = (await userSeasonRepository.getViewedByMonthAgo(req.user.id, month))
                .map(row => new SeasonTimeline(row));
        } else if (year) {
            response = (await userSeasonRepository.getSeasonsByAddedYear(req.user.id, year))
                .map(obj => new Season(obj));
        } else {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        res.status(200).json(response);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const updateBySeasonId = async (req, res) => {
    try {
        const { id } = req.params;
        const { platform } = req.body;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await seasonRepository.updateSeason(id, req.user.id, platform);
        res.status(200).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

module.exports = { deleteBySeasonId, getSeasons, updateBySeasonId };
