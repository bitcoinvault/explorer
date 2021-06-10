const express = require('express');
const csurf = require('csurf');
const router = express.Router();
const qrcode = require('qrcode');
const bitcoinjs = require('bitcoinjs-lib');
const addressApi = require("./../app/api/addressApi.js");
const sha256 = require("crypto-js/sha256");
const hexEnc = require("crypto-js/enc-hex");
const Decimal = require("decimal.js");
const d3ScaleChromatic = require("d3-scale-chromatic");

const utils = require('./../app/utils.js');
const coins = require("./../app/coins.js");
const config = require("./../app/config.js");
const coreApi = require("./../app/api/coreApi.js");
const helpers = require("./../app/helpers/colorGenerator.js");

const {statsPage} = require("./actions/stats");
const {aboutPage, coinDistributionPage, richestWalletsPage} = require("./actions/static-pages");
const {txActions} = require('./actions/tx');
const {addressActions} = require('./actions/address');

csurf({ignoreMethods: []});

router.get("/", (req, res, next) => {
    res.locals.homepage = true;

    let promises = [];

    promises.push(coreApi.getMempoolInfo());
    promises.push(coreApi.getMiningInfo());

    coreApi.getBlockchainInfo().then(getblockchaininfo => {
        res.locals.getblockchaininfo = getblockchaininfo;

        if (getblockchaininfo.chain !== 'regtest') {
            let targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;

            promises.push(coreApi.getTxCountStats(targetBlocksPerDay / 4, -targetBlocksPerDay, "latest"));

            let chainTxStatsIntervals = [targetBlocksPerDay, targetBlocksPerDay * 7, targetBlocksPerDay * 30, targetBlocksPerDay * 365]
                .filter(numBlocks => numBlocks <= getblockchaininfo.blocks);

            res.locals.chainTxStatsLabels = ["24 hours", "1 week", "1 month", "1 year"]
                .slice(0, chainTxStatsIntervals.length)
                .concat("All time");

            for (let i = 0; i < chainTxStatsIntervals.length; i++) {
                promises.push(coreApi.getChainTxStats(chainTxStatsIntervals[i]));
            }
        }

        let blockHeights = [];
        if (getblockchaininfo.blocks) {
            for (let i = 0; i < 10; i++) {
                blockHeights.push(getblockchaininfo.blocks - i);
            }
        }

        if (getblockchaininfo.chain !== 'regtest') {
            promises.push(coreApi.getChainTxStats(getblockchaininfo.blocks - 1));
        }

        coreApi.getBlocksByHeight(blockHeights).then(latestBlocks => {
            res.locals.latestBlocks = latestBlocks;

            Promise.all(promises).then(promiseResults => {
                res.locals.mempoolInfo = promiseResults[0];
                res.locals.miningInfo = promiseResults[1];

                if (getblockchaininfo.chain !== 'regtest') {
                    res.locals.txStats = promiseResults[2];

                    let chainTxStats = [];
                    for (let i = 0; i < res.locals.chainTxStatsLabels.length; i++) {
                        chainTxStats.push(promiseResults[i + 3]);
                    }

                    res.locals.chainTxStats = chainTxStats;
                }

                res.render("index");
            });
        });
    }).catch(err => {
        res.locals.userMessage = "Error loading recent blocks: " + err;

        res.render("index");
        next();
    });
});

router.get("/node-status", (req, res, next) => {
    coreApi.getBlockchainInfo().then(getblockchaininfo => {
        res.locals.getblockchaininfo = getblockchaininfo;

        coreApi.getNetworkInfo().then(getnetworkinfo => {
            res.locals.getnetworkinfo = getnetworkinfo;

            coreApi.getUptimeSeconds().then(uptimeSeconds => {
                res.locals.uptimeSeconds = uptimeSeconds;

                coreApi.getNetTotals().then(getnettotals => {
                    res.locals.getnettotals = getnettotals;

                    res.render("node-status");

                }).catch(err => {
                    res.locals.userMessage = "Error getting node status: (id=0), err=" + err;

                    res.render("node-status");

                    next();
                });
            }).catch(err => {
                res.locals.userMessage = "Error getting node status: (id=1), err=" + err;

                res.render("node-status");

                next();
            });
        }).catch(err => {
            res.locals.userMessage = "Error getting node status: (id=2), err=" + err;

            res.render("node-status");

            next();
        });
    }).catch(err => {
        res.locals.userMessage = "Error getting node status: (id=3), err=" + err;

        res.render("node-status");

        next();
    });
});

router.get("/mempool-summary", (req, res, next) => {
    coreApi.getMempoolInfo().then(getmempoolinfo => {
        res.locals.getmempoolinfo = getmempoolinfo;

        coreApi.getMempoolStats().then(mempoolstats => {
            res.locals.mempoolstats = mempoolstats;

            res.render("mempool-summary");
        });
    }).catch(err => {
        res.locals.userMessage = "Error: " + err;

        res.render("mempool-summary");

        next();
    });
});

router.get("/peers", (req, res, next) => {
    coreApi.getPeerSummary().then(peerSummary => {
        res.locals.peerSummary = peerSummary;

        let peerIps = [];
        for (let i = 0; i < peerSummary.getpeerinfo.length; i++) {
            let ipWithPort = peerSummary.getpeerinfo[i].addr;
            if (ipWithPort.lastIndexOf(":") >= 0) {
                let ip = ipWithPort.substring(0, ipWithPort.lastIndexOf(":"));
                if (ip.trim().length > 0) {
                    peerIps.push(ip.trim());
                }
            }
        }

        if (peerIps.length > 0) {
            utils.geoLocateIpAddresses(peerIps).then(results => {
                res.locals.peerIpSummary = results;

                res.render("peers");
            });
        } else {
            res.render("peers");
        }
    }).catch(err => {
        res.locals.userMessage = "Error: " + err;

        res.render("peers");

        next();
    });
});

router.get("/changeSetting", (req, res, next) => {
    if (req.query.name) {
        req.session[req.query.name] = req.query.value;

        res.cookie('user-setting-' + req.query.name, req.query.value);
    }

    res.redirect(req.headers.referer);
});

router.get("/blocks", (req, res, next) => {
    let limit = config.site.browseBlocksPageSize;
    let offset = 0;
    let sort = "desc";

    if (req.query.limit) {
        limit = parseInt(req.query.limit);
        if(limit > config.site.browseBlocksPageSizeLimit) {
            limit = config.site.browseBlocksPageSizeLimit
        }
    }

    if (req.query.offset) {
        offset = parseInt(req.query.offset);
    }

    if (req.query.sort) {
        sort = req.query.sort;
    }

    res.locals.limit = limit;
    res.locals.offset = offset;
    res.locals.sort = sort;
    res.locals.paginationBaseUrl = "/blocks";

    coreApi.getBlockchainInfo().then(getblockchaininfo => {
        res.locals.blockCount = getblockchaininfo.blocks;
        res.locals.blockOffset = offset;

        let blockHeights = [];
        if (sort === "desc") {
            for (let i = (getblockchaininfo.blocks - offset); i > (getblockchaininfo.blocks - offset - limit); i--) {
                if (i >= 0) {
                    blockHeights.push(i);
                }
            }
        } else {
            const offsetWithLimit = offset + limit;
            const limitTo = offsetWithLimit > getblockchaininfo.blocks ? getblockchaininfo.blocks + 1 : offsetWithLimit;
            for (let i = offset; i < limitTo; i++) {
                if (i >= 0) {
                    blockHeights.push(i);
                }
            }
        }

        coreApi.getBlocksByHeight(blockHeights).then(blocks => {
            res.locals.blocks = blocks;

            res.render("blocks");
        });
    }).catch(err => {
        res.locals.userMessage = "Error: " + err;

        res.render("blocks");

        next();
    });
});

router.get("/search", (req, res, next) => {
    if (!req.body.query) {
        req.session.userMessage = "Enter a block height, block hash, or transaction id.";
        req.session.userMessageType = "primary";

        res.render("search");
    }
});

router.post("/search", (req, res, next) => {
    if (!req.body.query) {
        req.session.userMessage = "Enter a block height, block hash, or transaction id.";

        res.redirect("/");

        return;
    }

    let query = req.body.query.toLowerCase().trim();
    let rawCaseQuery = req.body.query.trim();

    req.session.query = req.body.query;

    if (query.length === 64) {
        coreApi.getRawTransaction(query).then(tx => {
            if (tx) {
                res.redirect("/tx/" + query);

                return;
            }

            coreApi.getBlockByHash(query).then(blockByHash => {
                if (blockByHash) {
                    res.redirect("/block/" + query);

                    return;
                }

                coreApi.getAddress(rawCaseQuery).then(validateaddress => {
                    if (validateaddress && validateaddress.isvalid) {
                        res.redirect("/address/" + rawCaseQuery);

                        return;
                    }
                });

                req.session.userMessage = "No results found for query: " + query;

                res.redirect("/");

            }).catch(err => {
                req.session.userMessage = "No results found for query: " + query;

                res.redirect("/");
            });

        }).catch(err => {
            coreApi.getBlockByHash(query).then(blockByHash => {
                if (blockByHash) {
                    res.redirect("/block/" + query);

                    return;
                }

                req.session.userMessage = "No results found for query: " + query;

                res.redirect("/");

            }).catch(err => {
                req.session.userMessage = "No results found for query: " + query;

                res.redirect("/");
            });
        });

    } else if (!isNaN(query)) {
        coreApi.getBlockByHeight(parseInt(query)).then(blockByHeight => {
            if (blockByHeight) {
                res.redirect("/block-height/" + query);

                return;
            }

            req.session.userMessage = "No results found for query: " + query;

            res.redirect("/");
        });
    } else {
        coreApi.getAddress(rawCaseQuery).then(validateaddress => {
            if (validateaddress && validateaddress.isvalid) {
                res.redirect("/address/" + rawCaseQuery);

                return;
            }

            req.session.userMessage = "No results found for query: " + rawCaseQuery;

            res.redirect("/");
        });
    }
});

router.get("/block-height/:blockHeight", (req, res, next) => {
    let blockHeight = parseInt(req.params.blockHeight);

    res.locals.blockHeight = blockHeight;

    res.locals.result = {};

    let limit = config.site.blockTxPageSize;
    let offset = 0;

    if (req.query.limit) {
        limit = parseInt(req.query.limit);

        // for demo sites, limit page sizes
        if (limit > config.site.blockTxPageSize) {
            limit = config.site.blockTxPageSize;

            res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
        }
    }

    if (req.query.offset) {
        offset = parseInt(req.query.offset);
    }

    res.locals.limit = limit;
    res.locals.offset = offset;
    res.locals.paginationBaseUrl = "/block-height/" + blockHeight;

    coreApi.getBlockByHeight(blockHeight).then(result => {
        res.locals.result.getblockbyheight = result;

        coreApi.getBlockByHashWithTransactions(result.hash, limit, offset).then(result => {
            res.locals.result.getblock = result.getblock;
            res.locals.result.transactions = result.transactions;
            res.locals.result.txInputsByTransaction = result.txInputsByTransaction;

            res.render("block");
        });
    });
});

router.get("/block/:blockHash", (req, res, next) => {
    let blockHash = req.params.blockHash;

    res.locals.blockHash = blockHash;

    res.locals.result = {};

    let limit = config.site.blockTxPageSize;
    let offset = 0;

    if (req.query.limit) {
        limit = parseInt(req.query.limit);

        // for demo sites, limit page sizes
        if (limit > config.site.blockTxPageSize) {
            limit = config.site.blockTxPageSize;

            res.locals.userMessage = "Transaction page size limited to " + config.site.blockTxPageSize + ". If this is your site, you can change or disable this limit in the site config.";
        }
    }

    if (req.query.offset) {
        offset = parseInt(req.query.offset);
    }

    res.locals.limit = limit;
    res.locals.offset = offset;
    res.locals.paginationBaseUrl = "/block/" + blockHash;

    coreApi.getBlockByHashWithTransactions(blockHash, limit, offset).then(result => {
        res.locals.result.getblock = result.getblock;
        res.locals.result.transactions = result.transactions;
        res.locals.result.txInputsByTransaction = result.txInputsByTransaction;

        res.render("block");

    }).catch(err => {
        res.locals.userMessage = "Error getting block data";

        res.render("block");

        next();
    });
});



router.get("/unconfirmed-tx", (req, res, next) => {
    let limit = config.site.browseBlocksPageSize;
    let offset = 0;
    let sort = "desc";

    if (req.query.limit) {
        limit = parseInt(req.query.limit);
    }

    if (req.query.offset) {
        offset = parseInt(req.query.offset);
    }

    if (req.query.sort) {
        sort = req.query.sort;
    }

    res.locals.limit = limit;
    res.locals.offset = offset;
    res.locals.sort = sort;
    res.locals.paginationBaseUrl = "/unconfirmed-tx";

    coreApi.getMempoolDetails(offset, limit).then(mempoolDetails => {
        res.locals.mempoolDetails = mempoolDetails;
        res.render("unconfirmed-transactions");
    }).catch(err => {
        res.locals.userMessage = "Error: " + err;

        res.render("unconfirmed-transactions");

        next();
    });
});

router.get("/tx-stats", (req, res, next) => {
    let dataPoints = 100;

    if (req.query.dataPoints) {
        dataPoints = req.query.dataPoints;
    }

    if (dataPoints > 250) {
        dataPoints = 250;
    }

    let targetBlocksPerDay = 24 * 60 * 60 / global.coinConfig.targetBlockTimeSeconds;

    coreApi.getTxCountStats(dataPoints, 0, "latest").then(result => {
        res.locals.getblockchaininfo = result.getblockchaininfo;
        res.locals.txStats = result.txCountStats;

        coreApi.getTxCountStats(targetBlocksPerDay / 4, -144, "latest").then(result2 => {
            res.locals.txStatsDay = result2.txCountStats;

            coreApi.getTxCountStats(targetBlocksPerDay / 4, -144 * 7, "latest").then(result3 => {
                res.locals.txStatsWeek = result3.txCountStats;

                coreApi.getTxCountStats(targetBlocksPerDay / 4, -144 * 30, "latest").then(result4 => {
                    res.locals.txStatsMonth = result4.txCountStats;

                    res.render("tx-stats");
                });
            });
        });
    });
});


router.get("/mining-pools", (req, res, next) => {
    let miningPools = {
        addresses: [],
        counts: [],
    };
    let uiTheme = req.cookies['user-setting-uiTheme'];
    res.locals.fontColor = '#212529';

    if (uiTheme == 'dark') {
        res.locals.fontColor = '#f8f9fa';
    }

    if (global.miningPools) {
        global.miningPools.forEach(miningPool => {
            let addressName = utils.getNameFromAddress(miningPool.address);
            if (addressName === null) {
                addressName = miningPool.address;
            }
            miningPools.addresses.push(addressName);
            miningPools.counts.push(miningPool.count);
        });
    }
    let colorScale = d3ScaleChromatic.interpolateBlues;
    let colorRangeInfo = {
        colorStart: 0.2,
        colorEnd: 1,
        useEndAsStart: false,
    };
    let colors = helpers.generateColors(miningPools.addresses.length, colorScale, colorRangeInfo);

    miningPools.addresses = JSON.stringify(miningPools.addresses);
    res.locals.miningPools = miningPools;
    res.locals.colors = JSON.stringify(colors);

    res.render("mining-pools");
});

router.use('/tx', txActions)
router.use('/address', addressActions)


// Static pages
router.use('/about', aboutPage)
router.use('/richest-wallets', richestWalletsPage);
router.use('/coin-distribution', coinDistributionPage)
router.use('/stats', statsPage);

module.exports = router;
