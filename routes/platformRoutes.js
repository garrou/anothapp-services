import {Router} from "express";
import UserPlatformController from "../controllers/userPlatformController.js";

const router = Router();
const userPlatformController = new UserPlatformController();

router.get("/", userPlatformController.getUserPlatforms);

router.post("/", userPlatformController.addUserPlatforms);

router.delete("/:id", userPlatformController.deleteUserPlatform);

export default router;