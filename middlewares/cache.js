import Cache from "node-cache";

const cache = new Cache({checkperiod: 20});

/**
 * @param {number} duration
 * @param {boolean} eachUser
 * @param {(req: Request) => boolean} shouldCache lets a route group opt individual requests out of
 * caching (e.g. skip caching a user's own data so their own writes show up immediately, while still
 * caching the same route for a friend's read-only view)
 * @returns {Request, Response, NextFunction}
 */
export default (duration, eachUser = false, shouldCache = () => true) => (req, res, next) => {

    if (req.method !== "GET" || !shouldCache(req)) {
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

            if (res.statusCode < 400) {
                cache.set(key, body, duration);
            }
        }
        next();
    }
}