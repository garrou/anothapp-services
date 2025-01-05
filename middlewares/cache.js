import Cache from "node-cache";

const cache = new Cache({ checkperiod: 20 });

/**
 * @param {number} duration 
 * @param {boolean} eachUser
 * @returns (Request, Response, NextFunction)
 */
export default (duration, eachUser = false) => (req, res, next) => {

    if (req.method !== "GET") {
        return next();
    }
    const key = eachUser ? `${req.userId}-${req.originalUrl}` : req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
        res.json(cachedResponse);
    } else {
        res.originalJson = res.json;
        res.json = (body) => {
            res.originalJson(body);
            cache.set(key, body, duration);
        }
        next();
    }
}