import {Router} from "express";
import AuthController from "../controllers/authController.js";
import { loginLimiter, registerLimiter, refreshLimiter, logoutLimiter, cancelDeletionLimiter } from "../middlewares/rateLimit.js";

const router = new Router();
const authController = new AuthController();

router.get("/me", authController.checkUser);

router.post("/register", registerLimiter, authController.register);

router.post("/login", loginLimiter, authController.login);

router.post("/logout", logoutLimiter, authController.logout);

router.post("/refresh", refreshLimiter, authController.refreshToken);

router.post("/cancel-deletion", cancelDeletionLimiter, authController.cancelDeletion);

export default router;