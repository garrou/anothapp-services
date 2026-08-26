import {Router} from "express";
import NotificationController from "../controllers/notificationController.js";

const router = Router();
const notificationController = new NotificationController();

router.get("/", notificationController.getNotifications);

router.patch("/read", notificationController.markAllAsRead);

router.patch("/:id/read", notificationController.markAsRead);

export default router;
