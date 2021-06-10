const redis = require("redis");
const bluebird = require("bluebird");

const config = require("./config.js");
const utils = require("./utils.js");

let redisClient = null;

if (config.redisUrl) {
    bluebird.promisifyAll(redis.RedisClient.prototype);

    redisClient = redis.createClient({url: config.redisUrl});
}

const createCache = (keyPrefix, onCacheEvent) => ({
    get: key => {
        let prefixedKey = `${keyPrefix}-${key}`;

        return new Promise((resolve, reject) => {
            onCacheEvent("redis", "try", prefixedKey);

            redisClient.getAsync(prefixedKey).then(result => {
                if (result == null) {
                    onCacheEvent("redis", "miss", prefixedKey);

                    resolve(null);

                } else {
                    onCacheEvent("redis", "hit", prefixedKey);

                    resolve(JSON.parse(result));
                }
            }).catch(err => {
                onCacheEvent("redis", "error", prefixedKey);

                utils.logError("328rhwefghsdgsdss", err);

                reject(err);
            });
        });
    },
    set: (key, obj, maxAgeMillis) => {
        let prefixedKey = `${keyPrefix}-${key}`;

        redisClient.set(prefixedKey, JSON.stringify(obj), "PX", maxAgeMillis);
    }
});

module.exports = {
    active: (redisClient != null),
    createCache
}