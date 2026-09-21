import { Router } from "express";
import AdminController from "../controllers/adminController.js";

const router = Router();
const adminController = new AdminController();

router.get("/dashboard", adminController.getDashboard);

router.get("/users", adminController.searchUsers);

router.post("/users/:id/revoke-sessions", adminController.revokeUserSessions);

export default router;
