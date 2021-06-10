const express = require('express');
const addressActions = express.Router();
const coreApi = require("./../../app/api/coreApi.js");
const addressApi = require("./../../app/api/addressApi.js");
const utils = require('./../../app/utils.js');
const hexEnc = require("crypto-js/enc-hex");
const sha256 = require("crypto-js/sha256");
const bitcoinjs = require('bitcoinjs-lib');
const Decimal = require("decimal.js");
const qrcode = require('qrcode');

addressActions.get("/:address", (req, res, next) => {
    let limit = config.site.addressTxPageSize;
    let offset = 0;
    let sort = "desc";

    if (req.query.limit) {
        limit = parseInt(req.query.limit);

        if (limit > config.site.addressTxPageSizeLimit) {
            limit = config.site.addressTxPageSizeLimit;

            res.locals.userMessage = "Transaction page size limited to " + config.site.addressTxPageSizeLimit + ". If this is your site, you can change or disable this limit in the site config.";
        }
    }

    if (req.query.offset) {
        offset = parseInt(req.query.offset);
    }

    if (req.query.sort) {
        sort = req.query.sort;
    }

    let address = req.params.address;

    res.locals.address = address;
    res.locals.limit = limit;
    res.locals.offset = offset;
    res.locals.sort = sort;
    res.locals.paginationBaseUrl = `/address/${address}?sort=${sort}`;
    res.locals.transactions = [];
    res.locals.addressApiSupport = addressApi.getCurrentAddressApiFeatureSupport();

    res.locals.result = {};

    try {
        res.locals.addressObj = bitcoinjs.address.fromBase58Check(address);

    } catch (err) {
        if (!err.toString().startsWith("Error: Non-base58 character")) {
            res.locals.pageErrors.push(utils.logError("u3gr02gwef", err));
        }

        try {
            res.locals.addressObj = bitcoinjs.address.fromBech32(address);

        } catch (err2) {
            res.locals.pageErrors.push(utils.logError("u02qg02yqge", err));
        }
    }

    if (global.miningPoolsConfigs) {
        for (let i = 0; i < global.miningPoolsConfigs.length; i++) {
            if (global.miningPoolsConfigs[i].payout_addresses[address]) {
                res.locals.payoutAddressForMiner = global.miningPoolsConfigs[i].payout_addresses[address];
            }
        }
    }

    coreApi.getAddress(address).then(validateaddressResult => {
        res.locals.result.validateaddress = validateaddressResult;

        let promises = [];
        if (!res.locals.crawlerBot) {
            let addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(validateaddressResult.scriptPubKey)));
            addrScripthash = addrScripthash.match(/.{2}/g).reverse().join("");

            res.locals.electrumScripthash = addrScripthash;

            promises.push(new Promise((resolve, reject) => {
                addressApi.getAddressDetails(address, validateaddressResult.scriptPubKey, sort, limit, offset).then(addressDetailsResult => {
                    let addressDetails = addressDetailsResult.addressDetails;

                    if (addressDetailsResult.errors) {
                        res.locals.addressDetailsErrors = addressDetailsResult.errors;
                    }

                    if (addressDetails) {
                        res.locals.addressDetails = addressDetails;

                        if (addressDetails.balanceSat === 0) {
                            // make sure zero balances pass the falsey check in the UI
                            addressDetails.balanceSat = "0";
                        }

                        if (addressDetails.txCount === 0) {
                            // make sure txCount=0 pass the falsey check in the UI
                            addressDetails.txCount = "0";
                        }

                        if (addressDetails.txids) {
                            let txids = addressDetails.txids;

                            // if the active addressApi gives us blockHeightsByTxid, it saves us work, so try to use it
                            let blockHeightsByTxid = {};
                            if (addressDetails.blockHeightsByTxid) {
                                blockHeightsByTxid = addressDetails.blockHeightsByTxid;
                            }

                            res.locals.txids = txids;

                            coreApi.getRawTransactionsWithInputs(txids).then(rawTxResult => {
                                res.locals.transactions = rawTxResult.transactions;
                                res.locals.txInputsByTransaction = rawTxResult.txInputsByTransaction;

                                // for coinbase txs, we need the block height in order to calculate subsidy to display
                                let coinbaseTxs = [];
                                for (let i = 0; i < rawTxResult.transactions.length; i++) {
                                    let tx = rawTxResult.transactions[i];

                                    for (let j = 0; j < tx.vin.length; j++) {
                                        if (tx.vin[j].coinbase) {
                                            // addressApi sometimes has blockHeightByTxid already available, otherwise we need to query for it
                                            if (!blockHeightsByTxid[tx.txid]) {
                                                coinbaseTxs.push(tx);
                                            }
                                        }
                                    }
                                }

                                let coinbaseTxBlockHashes = [];
                                let blockHashesByTxid = {};
                                coinbaseTxs.forEach(tx => {
                                    coinbaseTxBlockHashes.push(tx.blockhash);
                                    blockHashesByTxid[tx.txid] = tx.blockhash;
                                });

                                let blockHeightsPromises = [];
                                if (coinbaseTxs.length > 0) {
                                    // we need to query some blockHeights by hash for some coinbase txs
                                    blockHeightsPromises.push(new Promise((resolve2, reject2) => {
                                        coreApi.getBlocksByHash(coinbaseTxBlockHashes).then(blocksByHashResult => {
                                            for (let txid in blockHashesByTxid) {
                                                if (blockHashesByTxid.hasOwnProperty(txid)) {
                                                    blockHeightsByTxid[txid] = blocksByHashResult[blockHashesByTxid[txid]].height;
                                                }
                                            }

                                            resolve2();

                                        }).catch(err => {
                                            res.locals.pageErrors.push(utils.logError("78ewrgwetg3", err));

                                            reject2(err);
                                        });
                                    }));
                                }

                                Promise.all(blockHeightsPromises).then(() => {
                                    let addrGainsByTx = {};
                                    let addrLossesByTx = {};

                                    res.locals.addrGainsByTx = addrGainsByTx;
                                    res.locals.addrLossesByTx = addrLossesByTx;

                                    let handledTxids = [];

                                    for (let i = 0; i < rawTxResult.transactions.length; i++) {
                                        let tx = rawTxResult.transactions[i];
                                        let txInputs = rawTxResult.txInputsByTransaction[tx.txid];

                                        if (handledTxids.includes(tx.txid)) {
                                            continue;
                                        }

                                        handledTxids.push(tx.txid);

                                        for (let j = 0; j < tx.vout.length; j++) {
                                            if (tx.vout[j].value > 0 && tx.vout[j].scriptPubKey && tx.vout[j].scriptPubKey.addresses && tx.vout[j].scriptPubKey.addresses.includes(address)) {
                                                if (addrGainsByTx[tx.txid] == null) {
                                                    addrGainsByTx[tx.txid] = new Decimal(0);
                                                }

                                                addrGainsByTx[tx.txid] = addrGainsByTx[tx.txid].plus(new Decimal(tx.vout[j].value));
                                            }
                                        }

                                        for (let j = 0; j < tx.vin.length; j++) {
                                            let txInput = txInputs[j];
                                            let vinJ = tx.vin[j];

                                            if (txInput != null) {
                                                if (txInput.vout[vinJ.vout] && txInput.vout[vinJ.vout].scriptPubKey && txInput.vout[vinJ.vout].scriptPubKey.addresses && txInput.vout[vinJ.vout].scriptPubKey.addresses.includes(address)) {
                                                    if (addrLossesByTx[tx.txid] == null) {
                                                        addrLossesByTx[tx.txid] = new Decimal(0);
                                                    }

                                                    addrLossesByTx[tx.txid] = addrLossesByTx[tx.txid].plus(new Decimal(txInput.vout[vinJ.vout].value));
                                                }
                                            }
                                        }
                                    }

                                    res.locals.blockHeightsByTxid = blockHeightsByTxid;

                                    resolve();

                                }).catch(err => {
                                    res.locals.pageErrors.push(utils.logError("230wefrhg0egt3", err));

                                    reject(err);
                                });

                            }).catch(err => {
                                res.locals.pageErrors.push(utils.logError("asdgf07uh23", err));

                                reject(err);
                            });

                        } else {
                            // no addressDetails.txids available
                            resolve();
                        }
                    } else {
                        // no addressDetails available
                        resolve();
                    }
                }).catch(err => {
                    res.locals.pageErrors.push(utils.logError("23t07ug2wghefud", err));

                    res.locals.addressApiError = err;

                    reject(err);
                });
            }));

            promises.push(new Promise((resolve, reject) => {
                coreApi.getBlockchainInfo().then(getblockchaininfo => {
                    res.locals.getblockchaininfo = getblockchaininfo;

                    resolve();

                }).catch(err => {
                    res.locals.pageErrors.push(utils.logError("132r80h32rh", err));

                    reject(err);
                });
            }));
        }

        promises.push(new Promise((resolve, reject) => {
            qrcode.toDataURL(address, (err, url) => {
                if (err) {
                    res.locals.pageErrors.push(utils.logError("93ygfew0ygf2gf2", err));
                }

                res.locals.addressQrCodeUrl = url;

                resolve();
            });
        }));

        Promise.all(promises.map(utils.reflectPromise)).then(() => {
            res.render("address");

        }).catch(err => {
            res.locals.pageErrors.push(utils.logError("32197rgh327g2", err));

            res.render("address");
        });

    }).catch(err => {
        res.locals.pageErrors.push(utils.logError("2108hs0gsdfe", err, {address: address}));

        res.locals.userMessage = "Failed to load address " + address + " (" + err + ")";

        res.render("address");
    });
});


module.exports = {
    addressActions
}