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

router.get("/:id/collaborators", playlistController.getCollaborators);

router.post("/:id/collaborators", playlistController.inviteCollaborator);

router.patch("/:id/collaborators/accept", playlistController.acceptCollaboratorInvite);

router.delete("/:id/collaborators/:userId", playlistController.removeCollaborator);

export default router;
