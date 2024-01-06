const { Router } = require("express");
const friendService = require("../services/friendService");
const userProfile = require("../services/userService");

const router = Router();

router.get("/", friendService.getFriends);

router.post("/", friendService.sendFriendRequest);

router.patch("/:userId", friendService.acceptFriend);

router.delete("/:userId", friendService.deleteFriend);

router.get("/:userId/profile", userProfile.getUser)

module.exports = router;