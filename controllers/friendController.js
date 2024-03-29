const { Router } = require("express");
const friendService = require("../services/friendService");

const router = Router();

router.get("/", friendService.getFriends);

router.post("/", friendService.sendFriendRequest);

router.patch("/:userId", friendService.acceptFriend);

router.delete("/:userId", friendService.deleteFriend);

module.exports = router;