const express = require('express');
const txActions = express.Router();
const coreApi = require("./../../app/api/coreApi.js");
const utils = require('./../../app/utils.js');

txActions.get("/:transactionId", (req, res, next) => {
    const txid = req.params.transactionId;

    let output = -1;
    if (req.query.output) {
        output = parseInt(req.query.output);
    }

    res.locals.txid = txid;
    res.locals.output = output;

    res.locals.result = {};

    coreApi.getRawTransaction(txid).then(rawTxResult => {
        res.locals.result.getrawtransaction = rawTxResult;

        let promises = [];

        promises.push(new Promise((resolve, reject) => {
            coreApi.getTxUtxos(rawTxResult).then(utxos => {
                res.locals.utxos = utxos;

                resolve();
            }).catch(err => {
                res.locals.pageErrors.push(utils.logError("3208yhdsghssr", err));

                reject(err);
            });
        }));

        if (rawTxResult.confirmations == null) {
            promises.push(new Promise((resolve, reject) => {
                coreApi.getMempoolTxDetails(txid).then(mempoolDetails => {
                    res.locals.mempoolDetails = mempoolDetails;

                    resolve();

                }).catch(err => {
                    res.locals.pageErrors.push(utils.logError("0q83hreuwgd", err));

                    reject(err);
                });
            }));
        }

        promises.push(new Promise((resolve, reject) => {
            client.command('getblock', rawTxResult.blockhash, (err3, result3, resHeaders3) => {
                res.locals.result.getblock = result3;

                let txids = [];
                for (let i = 0; i < rawTxResult.vin.length; i++) {
                    if (!rawTxResult.vin[i].coinbase) {
                        txids.push(rawTxResult.vin[i].txid);
                    }
                }

                coreApi.getRawTransactions(txids).then(txInputs => {

                    res.locals.result.txInputs = txInputs;

                    resolve();
                });
            });
        }));

        Promise.all(promises).then(() => {
            res.render("transaction");
        }).catch(err => {
            res.locals.pageErrors.push(utils.logError("1237y4ewssgt", err));
            res.render("transaction");
        });
    }).catch(err => {
        res.locals.userMessage = "Failed to load transaction with txid=" + txid + ": " + err;
        res.render("transaction");
    });
})


module.exports = {
    txActions
}