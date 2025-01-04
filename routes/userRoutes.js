import { Router }  from "express";
import userService from "../services/userService.js";

const router = Router();

router.post("/register", userService.register);

router.post("/login", userService.login);

router.post("/search", userService.getUser);

router.get("/me", userService.checkUser);

router.patch("/me", userService.changeProfile);

router.get("/profile", userService.getProfile);

router.get("/:id/profile", userService.getProfile);

export default router;