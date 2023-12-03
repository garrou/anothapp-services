require("dotenv").config();

const cors = require("cors");
const express = require("express");
const app = express();

const authController = require("./controllers/authController");
const homeController = require("./controllers/homeController");
const profileController  = require("./controllers/profileController");
const searchController = require("./controllers/searchController");
const seasonController = require("./controllers/seasonController");
const showController = require("./controllers/showController");
const statController = require("./controllers/statController");

const { checkJwt } = require( "./middlewares/guard");

app.use(cors({
    origin: process.env.ORIGIN,
    allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(express.json());

app.use("/intro", homeController);
app.use("/auth", authController);
app.use("/profile", checkJwt, profileController);
app.use("/search", checkJwt, searchController);
app.use("/shows", checkJwt, showController);
app.use("/seasons", checkJwt, seasonController);
app.use("/stats", checkJwt, statController);

app.listen(process.env.PORT);