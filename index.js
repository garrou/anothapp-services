require("dotenv").config();

const cors = require("cors");
const express = require("express");
const app = express();

const userController = require("./controllers/userController");
const favoriteController = require("./controllers/favoriteController");
const friendController = require("./controllers/friendController");
const homeController = require("./controllers/homeController");
const searchController = require("./controllers/searchController");
const seasonController = require("./controllers/seasonController");
const showController = require("./controllers/showController");
const statController = require("./controllers/statController");

const { checkJwt } = require( "./middlewares/guard");

app.use(cors({
    origins: [process.env.ORIGIN_REACT, process.env.ORIGIN_VUE],
    allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(express.json());

app.use("/intro", homeController);
app.use("/users", userController);
app.use("/search", checkJwt, searchController);
app.use("/shows", checkJwt, showController);
app.use("/seasons", checkJwt, seasonController);
app.use("/stats", checkJwt, statController);
app.use("/favorites", checkJwt, favoriteController);
app.use("/friends", checkJwt, friendController);

app.listen(process.env.PORT);