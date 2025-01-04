import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { checkJwt } from "./middlewares/guard.js";
import { errorHandler } from "./middlewares/error.js";
import userRoutes from "./routes/userRoutes.js";
import cache from "./middlewares/cache.js";
import searchRoutes from "./routes/searchRoutes.js";
import showRoutes from "./routes/showRoutes.js";
import seasonRoutes from "./routes/seasonRoutes.js";
import statRoutes from "./routes/statRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";

class App {
    constructor() {
        dotenv.config();
        this.app = express();
        this.#setupCors();
        this.#setupMiddleware();
        this.#setupRoutes();
        this.#setupErrorHandler();
    }

    #setupErrorHandler() {
        this.app.use(errorHandler);
    }

    #setupMiddleware() {
        this.app.use(express.json());
    }

    #setupCors() {
        this.app.use(cors({
            origins: [process.env.ORIGIN],
            allowedHeaders: ["Authorization", "Content-Type"]
        }));
    }

    #setupRoutes() {
        this.app.use("/users", checkJwt, userRoutes);
        this.app.use("/search", checkJwt, cache(3600), searchRoutes);
        this.app.use("/shows", checkJwt, showRoutes);
        this.app.use("/seasons", checkJwt, seasonRoutes);
        this.app.use("/stats", checkJwt, cache(60, true), statRoutes);
        this.app.use("/friends", checkJwt, friendRoutes);
    }

    listen() {
        this.app.listen(process.env.PORT);
    }
}

export default new App();