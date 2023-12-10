const seasonRepository = require("../repositories/seasonRepository");

const deleteBySeasonId = async (req, res) => {
    try {
        const { id } = req.params;
        await seasonRepository.deleteSeasonById(id);
        res.sendStatus(204);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = { deleteBySeasonId };