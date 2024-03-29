const Cache = require("node-cache");

const cache = new Cache({ checkPeriod: 20 });

/**
 * @param {Number} duration 
 * @param {Boolean} eachUser
 * @returns (Request, Response, NextFunction)
 */
module.exports = (duration, eachUser) => (req, res, next) => {

    if (req.method !== "GET") {
        return next();
    }
    const key = eachUser ? `${req.user.id}-${req.originalUrl}` : req.originalUrl;
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