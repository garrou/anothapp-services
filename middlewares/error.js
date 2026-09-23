import {isDevMode} from "../helpers/utils.js";
import ServiceError from "../helpers/serviceError.js";

export const errorHandler = (err, req, res, _) => {
    const status = err.status || 500;
    const message = err instanceof ServiceError ? err.message : "Internal Server Error";

    if (isDevMode()) {
        console.log(err);
    }
    res.status(status).json({message});
};