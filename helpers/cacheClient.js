import NodeCache from "node-cache";

/**
 * @param {Object} options node-cache constructor options (stdTTL, checkperiod, ...)
 * @returns {NodeCache}
 */
const createCache = (options) => new NodeCache(options);

export default createCache;
