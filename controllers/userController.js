const { Router } = require("express");
const userService = require("../services/userService");
const { checkJwt } = require("../middlewares/guard");

const router = Router();

router.post("/register", userService.register);

router.post("/login", userService.login);

router.post("/search", checkJwt, userService.getUser);

router.get("/me", checkJwt, userService.checkUser);

router.post("/me/password", checkJwt, userService.changePassword);

router.post("/me/email", checkJwt, userService.changeEmail);

router.get("/profile", checkJwt, userService.getProfile);

router.get("/:id/profile", checkJwt, userService.getProfile);

router.patch("/profile/image", checkJwt, userService.setProfilePicture);

module.exports = router;