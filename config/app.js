import express from "express";
import cors from "cors";
import routes from "../routes/index.js";
import {errorHandler} from "../middlewares/error.js";

class App {
    constructor() {
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
        this.app.use("/", routes);
    }

    listen() {
        this.app.listen(process.env.PORT);
    }
}

export default new App();