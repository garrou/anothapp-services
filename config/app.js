import express from "express";
import cors from "cors";
import routes from "../routes/index.js";
import {errorHandler} from "../middlewares/error.js";

class App {
    constructor() {
        this.app = express();
        this._setupCors();
        this._setupMiddleware();
        this._setupRoutes();
        this._setupErrorHandler();
    }

    _setupErrorHandler() {
        this.app.use(errorHandler);
    }

    _setupMiddleware() {
        this.app.use(express.json());
    }

    _setupCors() {
        this.app.use(cors({
            origins: [process.env.ORIGIN],
            allowedHeaders: ["Authorization", "Content-Type"]
        }));
    }

    _setupRoutes() {
        this.app.use("/", routes);
    }

    listen() {
        this.app.listen(process.env.PORT);
    }
}

export default new App();