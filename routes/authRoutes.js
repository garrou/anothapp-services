import {Router} from "express";
import AuthController from "../controllers/authController.js";

const router = new Router();
const authController = new AuthController();

router.get("/me", authController.checkUser);

router.post("/register", authController.register);

router.post("/login", authController.login);

export default router;