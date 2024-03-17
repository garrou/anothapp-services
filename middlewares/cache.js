const Cache = require("node-cache");

const cache = new Cache({ checkPeriod: 60 });

/**
 * @param {Number} duration 
 * @returns (Request, Response, NextFunction)
 */
module.exports = (duration) => (req, res, next) => {

    if (req.method !== "GET") {
        return next();
    }
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
        console.log(`Cached response ${key}`);
        res.json(cachedResponse);
    } else {
        console.log(`Add cached response for ${key}`);
        res.originalJson = res.json;
        res.json = (body) => {
            res.originalJson(body);
            cache.set(key, body, duration);
        }
        next();
    }
}