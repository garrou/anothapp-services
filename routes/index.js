import {Router} from "express";
import {checkJwt} from "../middlewares/guard.js";
import cache from "../middlewares/cache.js";
import userRoutes from "./userRoutes.js";
import authRoutes from "./authRoutes.js";
import searchRoutes from "./searchRoutes.js";
import showRoutes from "./showRoutes.js";
import seasonRoutes from "./seasonRoutes.js";
import episodeRoutes from "./episodeRoutes.js";
import statRoutes from "./statRoutes.js";
import friendRoutes from "./friendRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import platformRoutes from "./platformRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import actorRoutes from "./actorRoutes.js";
import NotificationListener from "../services/notificationListener.js";

new NotificationListener();

const router = new Router();

router.use("/auth", checkJwt, authRoutes);
router.use("/users", checkJwt, userRoutes);
router.use("/search", checkJwt, cache(3600), searchRoutes);
router.use("/shows", checkJwt, showRoutes);
router.use("/seasons", checkJwt, seasonRoutes);
router.use("/episodes", checkJwt, episodeRoutes);
router.use("/stats", checkJwt, cache(600, true, (req) => Boolean(req.query.id) && req.query.id !== req.userId), statRoutes);
router.use("/friends", checkJwt, friendRoutes);
router.use("/settings", checkJwt, settingsRoutes);
router.use("/platforms", checkJwt, platformRoutes);
router.use("/notifications", checkJwt, notificationRoutes);
router.use("/actors", checkJwt, actorRoutes);

router.use("*", (req, res) => {
    res.status(404).json({ message: "Not found" });
});

export default router;