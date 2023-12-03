const { Router } = require("express");
const profileService = require("../services/profileService");

const router = Router();

router.get("/", profileService.getProfile);

router.patch("/image", profileService.setProfilePicture);

module.exports = router;