import {Router} from "express";
import FriendController from "../controllers/friendController.js";

const router = Router();
const friendController = new FriendController();

router.get("/", friendController.getFriends);

router.post("/", friendController.sendFriendRequest);

router.patch("/:userId", friendController.acceptFriend);

router.delete("/:userId", friendController.deleteFriend);

router.get("/:userId/auto-accept-watch-together", friendController.getAutoAcceptWatchTogether);

router.patch("/:userId/auto-accept-watch-together", friendController.setAutoAcceptWatchTogether);

export default router;