const { Router } = require("express");
const friendService = require("../services/friendService");

const router = Router();

router.get("/", friendService.getFriends);

router.post("/", friendService.sendFriendRequest);

router.get("/:userId", friendService.getFriend);

router.patch("/:userId", friendService.updateFriendRequest);

module.exports = router;