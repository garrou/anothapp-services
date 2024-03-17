const { Router } = require("express");
const userService = require("../services/userService");

const router = Router();

router.post("/register", userService.register);

router.post("/login", userService.login);

router.post("/search", userService.getUser);

router.get("/me", userService.checkUser);

router.post("/me/password", userService.changePassword);

router.post("/me/email", userService.changeEmail);

router.get("/profile", userService.getProfile);

router.get("/:id/profile", userService.getProfile);

router.patch("/profile/image", userService.setProfilePicture);

module.exports = router;