#!/usr/bin/env node

'use strict';

const os = require('os');
const path = require('path');
const dotenv = require("dotenv");
const fs = require('fs');

const configPaths = [path.join(os.homedir(), '.config', 'btcv-rpc-explorer.env'), path.join(process.cwd(), '.env')];
configPaths.filter(fs.existsSync).forEach(path => {
    console.log('Loading env file:', path);
    dotenv.config({path});
});

global.cacheStats = {};

// debug module is already loaded by the time we do dotenv.config
// so refresh the status of DEBUG env var
const debug = require("debug");
debug.enable(process.env.DEBUG || "btcexp:app,btcexp:error");

const debugLog = debug("btcexp:app");

const express = require('express');
const helmet = require("helmet");
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('cookie-session')
const csurf = require("csurf");
const config = require("./app/config.js");
const utils = require("./app/utils.js");
const moment = require("moment");
const Decimal = require('decimal.js');
const bitcoinCore = require("bitcoin-core");
const pug = require("pug");
const momentDurationFormat = require("moment-duration-format");
const coreApi = require("./app/api/coreApi.js");
const coins = require("./app/coins.js");
const request = require("request");
const qrcode = require("qrcode");
const addressApi = require("./app/api/addressApi.js");
const electrumAddressApi = require("./app/api/electrumAddressApi.js");
const auth = require('./app/auth.js');
const compression = require('compression')
const crawlerBotUserAgentStrings = ["Googlebot", "Bingbot", "Slurp", "DuckDuckBot", "Baiduspider", "YandexBot", "Sogou", "Exabot", "facebot", "ia_archiver"];
const baseActionsRouter = require('./routes/baseActionsRouter');

const app = express();
app.use(cookieParser());
app.set('etag', false);
app.use(helmet({
    contentSecurityPolicy: false,
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));

// ref: https://blog.stigok.com/post/disable-pug-debug-output-with-expressjs-web-app
app.engine('pug', (path, options, fn) => {
    options.debug = false;
    return pug.__express.call(null, path, options, fn);
});

app.set('view engine', 'pug');

// basic http authentication
if (process.env.BTCEXP_BASIC_AUTH_PASSWORD) {
    app.use(auth(process.env.BTCEXP_BASIC_AUTH_PASSWORD));
}

app.use(favicon(__dirname + '/public/favicon.png'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
    name: 'btcv.session',
    keys: [
        config.cookieSecret
    ]
}));

process.on("unhandledRejection", (reason, p) => {
    debugLog("Unhandled Rejection at: Promise", p, "reason:", reason, "stack:", (reason != null ? reason.stack : "null"));
});

function loadMiningPoolConfigs() {
    global.miningPoolsConfigs = [];

    const miningPoolsConfigDir = path.join(__dirname, "public", "txt", "mining-pools-configs", global.coinConfig.ticker);

    fs.readdir(miningPoolsConfigDir, (err, files) => {
        if (err) {
            utils.logError("3ufhwehe", err, {configDir: miningPoolsConfigDir, desc: "Unable to scan directory"});

            return;
        }

        files.forEach(file => {
            let filepath = path.join(miningPoolsConfigDir, file);

            let contents = fs.readFileSync(filepath, 'utf8');

            global.miningPoolsConfigs.push(JSON.parse(contents));
        });
    });

    for (let i = 0; i < global.miningPoolsConfigs.length; i++) {
        for (let x in global.miningPoolsConfigs[i].payout_addresses) {
            if (global.miningPoolsConfigs[i].payout_addresses.hasOwnProperty(x)) {
                global.specialAddresses[x] = {
                    type: "minerPayout",
                    minerInfo: global.miningPoolsConfigs[i].payout_addresses[x]
                };
            }
        }
    }
}

app.runOnStartup = () => {
    global.appStartTime = new Date().getTime();
    global.config = config;
    global.coinConfig = coins[config.coin];
    global.coinConfigs = coins;

    debugLog(`Running RPC Explorer for ${global.coinConfig.name}`);

    let rpcCred = config.credentials.rpc;
    debugLog(`Connecting via RPC to node at ${rpcCred.host}:${rpcCred.port}`);

    const rpcClientProperties = {
        host: rpcCred.host,
        port: rpcCred.port,
        username: rpcCred.username,
        password: rpcCred.password,
        timeout: rpcCred.timeout
    };

    global.client = new bitcoinCore(rpcClientProperties);

    coreApi.getNetworkInfo().then(getnetworkinfo => {
        debugLog(`Connected via RPC to node. Basic info: version=${getnetworkinfo.version}, subversion=${getnetworkinfo.subversion}, protocolversion=${getnetworkinfo.protocolversion}, services=${getnetworkinfo.localservices}`);

    }).catch(err => {
        utils.logError("32ugegdfsde", err);
    });

    if (config.addressApi) {
        var supportedAddressApis = addressApi.getSupportedAddressApis();
        if (!supportedAddressApis.includes(config.addressApi)) {
            utils.logError("32907ghsd0ge", `Unrecognized value for BTCEXP_ADDRESS_API: '${config.addressApi}'. Valid options are: ${supportedAddressApis}`);
        }

        if (config.addressApi === "electrumx") {
            if (config.electrumXServers && config.electrumXServers.length > 0) {
                electrumAddressApi.connectToServers().then(() => {
                    global.electrumAddressApi = electrumAddressApi;

                }).catch(err => {
                    utils.logError("31207ugf4e0fed", err, {electrumXServers: config.electrumXServers});
                });
            } else {
                utils.logError("327hs0gde", "You must set the 'BTCEXP_ELECTRUMX_SERVERS' environment variable when BTCEXP_ADDRESS_API=electrumx.");
            }
        }
    }

    loadMiningPoolConfigs();

    if (!global.exchangeRates) {
        utils.refreshExchangeRates();
    }

    if (!global.totalCoinSupply) {
        utils.refreshCoinSupply();
    }

    if (!global.totalWalletsNumber) {
        utils.refreshWalletsNumber();
    }

    if (!global.txAvgVolume24h) {
        utils.refreshTxVolume();
    }

    if (!global.miningPools) {
        utils.refreshMiningPoolsData();
    }

    if (!global.coinsInCirculation) {
      utils.refreshCoinsInCirculation();
    }
    
    if (!global.marketCap) {
      utils.refreshMarketCap();
    }

    const refreshInterval = {
        exchangeRates: parseInt(process.env.BTCEXP_REFRESH_EXCHANGE_RATE_INTERVAL || 5),		// default: 5min
        coinSupply: parseInt(process.env.BTCEXP_REFRESH_COIN_SUPPLY_INTERVAL || 1),				// default: 1min
        walletsNumber: parseInt(process.env.BTCEXP_REFRESH_WALLETS_NUMBER_INTERVAL || 1),		// default: 1min
        txVolume: parseInt(process.env.BTCEXP_REFRESH_TX_VOLUME_INTERVAL || 1),					// default: 1min
        miningPoolsData: parseInt(process.env.BTCEXP_REFRESH_MINING_POOLS_DATA_INTERVAL || 1),	// default: 1min
        coinsInCirculation: parseInt(process.env.BTCEXP_REFRESH_COINS_IN_CIRCULATION_INTERVAL || 1),	// default: 1min
        marketCap: parseInt(process.env.BTCEXP_REFRESH_MARKET_CAP_INTERVAL || 1),	// default: 1min
    };

    // just dump info
    debugLog(`RefreshExchangeRates interval: ${refreshInterval.exchangeRates}min`);
    debugLog(`RefreshCoinSupply interval: ${refreshInterval.coinSupply}min`);
    debugLog(`RefreshWalletsNumber interval: ${refreshInterval.walletsNumber}min`);
    debugLog(`RefreshTxVolume interval: ${refreshInterval.txVolume}min`);
    debugLog(`RefreshMiningPoolsData interval: ${refreshInterval.miningPoolsData}min`);
    debugLog(`RefreshCoinsInCirculationData interval: ${refreshInterval.coinsInCirculation}min`);
    debugLog(`RefreshMarketCapData interval: ${refreshInterval.marketCap}min`);

    // refresh exchange rate periodically
    setInterval(utils.refreshExchangeRates, refreshInterval.exchangeRates * 60 * 1000);
    setInterval(utils.refreshCoinSupply, refreshInterval.coinSupply * 60 * 1000);
    setInterval(utils.refreshWalletsNumber, refreshInterval.walletsNumber * 60 * 1000);
    setInterval(utils.refreshTxVolume, refreshInterval.txVolume * 60 * 1000);
    setInterval(utils.refreshMiningPoolsData, refreshInterval.miningPoolsData * 60 * 1000);
    setInterval(utils.refreshCoinsInCirculation, refreshInterval.coinsInCirculation * 60 * 1000);
    setInterval(utils.refreshMarketCap, refreshInterval.marketCap * 60 * 1000);

    utils.logMemoryUsage();
};

app.use((req, res, next) => {
    // make session available in templates
    res.locals.session = req.session;

    var userAgent = req.headers['user-agent'];
    for (var i = 0; i < crawlerBotUserAgentStrings.length; i++) {
        if (userAgent.indexOf(crawlerBotUserAgentStrings[i]) !== -1) {
            res.locals.crawlerBot = true;
        }
    }

    res.locals.config = global.config;
    res.locals.coinConfig = global.coinConfig;

    res.locals.host = config.credentials.rpc.host;
    res.locals.port = config.credentials.rpc.port;

    res.locals.genesisBlockHash = coreApi.getGenesisBlockHash();
    res.locals.genesisCoinbaseTransactionId = coreApi.getGenesisCoinbaseTransactionId();

    res.locals.pageErrors = [];

    // currency format type
    if (!req.session.currencyFormatType) {
        req.session.currencyFormatType = req.cookies['user-setting-currencyFormatType'] || "";
    }
    res.locals.currencyFormatType = req.session.currencyFormatType;

    // theme
    if (!req.session.uiTheme) {
        req.session.uiTheme = req.cookies['user-setting-uiTheme'] || "";
    }

    // homepage banner
    if (!req.session.hideHomepageBanner) {
        req.session.hideHomepageBanner = req.cookies['user-setting-hideHomepageBanner'] || "false";
    }

    if (req.session.userMessage) {
        res.locals.userMessage = req.session.userMessage;
        res.locals.userMessageType = req.session.userMessageType || "warning";

        req.session.userMessage = null;
        req.session.userMessageType = null;
    }

    if (req.session.query) {
        res.locals.query = req.session.query;

        req.session.query = null;
    }

    // make some var available to all request
    // ex: req.cheeseStr = "cheese";

    next();
});

app.use(csurf(), (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use('/', baseActionsRouter);

app.use(express.static('public', {index: false, etag: false, fallthrough: true}));

app.use((err, req, res, next) => {
    let errToRender = {};
    if (app.get('env') === 'development') {
        errToRender = err;
    }

    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: errToRender
    });
});

app.use((req, res, next) => {
    res.status(404);
    res.render('error', {
        message: '404 - page not found',
        error: 'Page not found.'
    });
});

app.locals.moment = moment;
app.locals.Decimal = Decimal;
app.locals.utils = utils;

module.exports = app;
