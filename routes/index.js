import {Router} from "express";
import {checkJwt} from "../middlewares/guard.js";
import cache from "../middlewares/cache.js";
import userRoutes from "./userRoutes.js";
import authRoutes from "./authRoutes.js";
import searchRoutes from "./searchRoutes.js";
import showRoutes from "./showRoutes.js";
import seasonRoutes from "./seasonRoutes.js";
import statRoutes from "./statRoutes.js";
import friendRoutes from "./friendRoutes.js";

const router = new Router();

router.use("/auth", checkJwt, authRoutes);
router.use("/users", checkJwt, userRoutes);
router.use("/search", checkJwt, cache(3600), searchRoutes);
router.use("/shows", checkJwt, showRoutes);
router.use("/seasons", checkJwt, seasonRoutes);
router.use("/stats", checkJwt, cache(600, true), statRoutes);
router.use("/friends", checkJwt, friendRoutes);

router.use("*", (req, res) => {
    res.status(404).json({ message: "Not found" });
});

export default router;