import {Router} from "express";
import PlaylistController from "../controllers/playlistController.js";

const router = Router();
const playlistController = new PlaylistController();

router.get("/", playlistController.getPlaylists);

router.post("/", playlistController.createPlaylist);

router.get("/:id", playlistController.getPlaylistById);

router.patch("/:id", playlistController.updatePlaylist);

router.delete("/:id", playlistController.deletePlaylist);

router.post("/:id/shows", playlistController.addShowToPlaylist);

router.delete("/:id/shows/:showId", playlistController.removeShowFromPlaylist);

export default router;
