import {Router} from "express";
import UserController from "../controllers/userController.js";

const router = Router();
const userController = new UserController();

router.post("/search", userController.getUser);

router.patch("/me", userController.changeProfile);

router.get("/profile", userController.getProfile);

router.get("/:id/profile", userController.getProfile);

export default router;