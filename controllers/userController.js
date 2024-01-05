const { Router } = require("express");
const userService = require("../services/userService");
const { checkJwt } = require("../middlewares/guard");

const router = Router();

router.get("/", checkJwt, userService.getUser);

router.post("/register", userService.register);

router.post("/login", userService.login);

router.get("/me", checkJwt, userService.checkUser);

module.exports = router;