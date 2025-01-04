import { Router } from "express";
import { FriendController } from "../controllers/friendController.js";

const router = Router();
const friendController = new FriendController();

router.get("/", friendController.getFriends);

router.post("/", friendController.sendFriendRequest);

router.patch("/:userId", friendController.acceptFriend);

router.delete("/:userId", friendController.deleteFriend);

export default router;