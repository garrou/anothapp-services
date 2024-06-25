require("dotenv").config();

const cors = require("cors");
const express = require("express");
const app = express();

const userController = require("./controllers/userController");
const friendController = require("./controllers/friendController");
const searchController = require("./controllers/searchController");
const seasonController = require("./controllers/seasonController");
const showController = require("./controllers/showController");
const statController = require("./controllers/statController");

const { checkJwt } = require( "./middlewares/guard");
const cache = require("./middlewares/cache");

app.use(cors({
    origins: [process.env.ORIGIN],
    allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(express.json());

app.use("/users", checkJwt, userController);
app.use("/search", checkJwt, cache(3600, false), searchController);
app.use("/shows", checkJwt, showController);
app.use("/seasons", checkJwt, cache(3600, true), seasonController);
app.use("/stats", checkJwt, cache(60, true), statController);
app.use("/friends", checkJwt, friendController);

app.listen(process.env.PORT);