import {Router} from "express";
import ActorController from "../controllers/actorController.js";

const router = Router();
const actorController = new ActorController();

router.get("/favorites", actorController.getFavorites);

router.post("/:id/favorite", actorController.addFavorite);

router.delete("/:id/favorite", actorController.removeFavorite);

export default router;
