const { Router } = require("express");
const authService = require("../services/authService");
const { checkJwt } = require("../middlewares/guard");

const router = Router();

router.post("/register", authService.register);

router.post("/login", authService.login);

router.get("/me", checkJwt, authService.checkUser);

module.exports = router;