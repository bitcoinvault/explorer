const config = require("./../config.js");
const coins = require("../coins.js");
const utils = require("../utils.js");

const coinConfig = coins[config.coin];

const electrumAddressApi = require("./electrumAddressApi.js");

function getSupportedAddressApis() {
    return ["electrumx"];
}

function getCurrentAddressApiFeatureSupport() {
    return {
        pageNumbers: true,
        sortDesc: true,
        sortAsc: true
    };
}

function getAddressDetails(address, scriptPubkey, sort, limit, offset) {
    return new Promise(function (resolve, reject) {
        let promises = [];

        if (config.addressApi === "electrumx") {
            promises.push(electrumAddressApi.getAddressDetails(address, scriptPubkey, sort, limit, offset));

        } else {
            promises.push(new Promise(function (resolve, reject) {
                resolve({addressDetails: null, errors: ["No address API configured"]});
            }));
        }

        Promise.all(promises).then(function (results) {
            if (results && results.length > 0) {
                resolve(results[0]);
            } else {
                resolve(null);
            }
        }).catch(function (err) {
            utils.logError("239x7rhsd0gs", err);

            reject(err);
        });
    });
}

module.exports = {
    getSupportedAddressApis,
    getCurrentAddressApiFeatureSupport,
    getAddressDetails
};