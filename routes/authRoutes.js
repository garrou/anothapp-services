import {Router} from "express";
import AuthController from "../controllers/authController.js";
import { loginLimiter, registerLimiter, refreshLimiter, logoutLimiter } from "../middlewares/rateLimit.js";

const router = new Router();
const authController = new AuthController();

router.get("/me", authController.checkUser);

router.post("/register", registerLimiter, authController.register);

router.post("/login", loginLimiter, authController.login);

router.post("/logout", logoutLimiter, authController.logout);

router.post("/refresh", refreshLimiter, authController.refreshToken);

export default router;