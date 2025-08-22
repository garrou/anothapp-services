import express from "express";
import cors from "cors";
import routes from "../routes/index.js";
import {errorHandler} from "../middlewares/error.js";

class App {
    constructor() {
        this._app = express();
        this.#setupCors();
        this.#setupMiddleware();
        this.#setupRoutes();
        this.#setupErrorHandler();
    }

    #setupErrorHandler() {
        this._app.use(errorHandler);
    }

    #setupMiddleware() {
        this._app.use(express.json());
    }

    #setupCors() {
        this._app.use(cors({
            origins: [process.env.ORIGIN],
            allowedHeaders: ["Authorization", "Content-Type"],
            exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Type"]
        }));
    }

    #setupRoutes() {
        this._app.use("/", routes);
    }

    listen() {
        this._app.listen(process.env.PORT);
    }
}

export default new App();