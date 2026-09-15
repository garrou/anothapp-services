import {Router} from "express";
import UserController from "../controllers/userController.js";

const router = Router();
const userController = new UserController();

router.get("/", userController.getUsers);

router.patch("/me", userController.changeProfile);

router.delete("/me", userController.requestDeletion);

router.get("/profile", userController.getProfile);

router.get("/:id", userController.getProfile);

export default router;