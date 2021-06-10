const v8 = require('v8');
const express = require('express');
const router = express.Router();

const statsPage = router.get("/", (req, res) => {
    res.locals.appStartTime = global.appStartTime;
    res.locals.memstats = v8.getHeapStatistics();
    res.locals.rpcStats = global.rpcStats;
    res.locals.cacheStats = global.cacheStats;
    res.locals.errorStats = global.errorStats;

    res.locals.appConfig = {
        privacyMode: config.privacyMode,
        rpcConcurrency: config.rpcConcurrency,
        addressApi: config.addressApi,
        ipStackComApiAccessKey: !!config.credentials.ipStackComApiAccessKey,
        redisCache: !!config.redisUrl,
        noInmemoryRpcCache: config.noInmemoryRpcCache
    };

    res.render("stats");
});

module.exports = {
    statsPage
}