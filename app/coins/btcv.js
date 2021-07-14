const Decimal = require("decimal.js");
Decimal8 = Decimal.clone({precision: 8, rounding: 8});

const currencyUnits = [
    {
        type: "native",
        name: "BTCV",
        multiplier: 1,
        default: true,
        values: ["", "btcv", "BTCV"],
        decimalPlaces: 8
    },
    {
        type: "native",
        name: "mBTCV",
        multiplier: 1000,
        values: ["mbtcv"],
        decimalPlaces: 5
    },
    {
        type: "native",
        name: "bits",
        multiplier: 1000000,
        values: ["bits"],
        decimalPlaces: 2
    },
    {
        type: "native",
        name: "sat",
        multiplier: 100000000,
        values: ["sat", "satoshi"],
        decimalPlaces: 0
    },
    {
        type: "exchanged",
        name: "USD",
        multiplier: "usd",
        values: ["usd"],
        decimalPlaces: 2,
        symbol: "$"
    },
    {
        type: "exchanged",
        name: "EUR",
        multiplier: "eur",
        values: ["eur"],
        decimalPlaces: 2,
        symbol: "€"
    },
];

module.exports = {
    name: "Bitcoin Vault",
    ticker: "BTCV",
    logoUrl: "/img/logo/btc.svg",
    siteTitle: "Bitcoin Vault Explorer",
    siteDescriptionHtml: "<b>BTCV Explorer</b> is <a href='https://github.com/bitcoinvault/explorer). If you run your own [Bitcoin Vault Full Node](https://bitcoin.org/en/full-node), **BTCV Explorer** can easily run alongside it, communicating via RPC calls. See the project [ReadMe](https://github.com/bitcoinvault/explorer) for a list of features and instructions for running.",
    nodeTitle: "Bitcoin Full Node",
    nodeUrl: "https://bitcoin.org/en/full-node",
    demoSiteUrl: "https://explorer.bitcoinvault.global",
    miningPoolsConfigUrls: [
        "https://raw.githubusercontent.com/btccom/Blockchain-Known-Pools/master/pools.json",
        "https://raw.githubusercontent.com/blockchain/Blockchain-Known-Pools/master/pools.json"
    ],
    maxBlockWeight: 4000000,
    targetBlockTimeSeconds: 600,
    currencyUnits: currencyUnits,
    currencyUnitsByName: {
        "BTCV": currencyUnits[0],
        "mBTCV": currencyUnits[1],
        "bits": currencyUnits[2],
        "sat": currencyUnits[3]
    },
    baseCurrencyUnit: currencyUnits[3],
    defaultCurrencyUnit: currencyUnits[0],
    feeSatoshiPerByteBucketMaxima: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100, 150],
    genesisBlockHash: "0000000028ce26975b32feda3d75ac3fe10372f75062366cfba4e934dcc6a48b",
    genesisCoinbaseTransactionId: "8b92cc030bdb6a02d3dc3d510826e38efb0f1c59c167fac0b96bc73432d55a01",
    genesisCoinbaseTransaction: {
        "hex": "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0804ffff001d02fd04ffffffff0100f2052a01000000434104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac00000000",
        "txid": "8b92cc030bdb6a02d3dc3d510826e38efb0f1c59c167fac0b96bc73432d55a01",
        "hash": "8b92cc030bdb6a02d3dc3d510826e38efb0f1c59c167fac0b96bc73432d55a01",
        "size": 204,
        "vsize": 204,
        "version": 1,
        "confirmations": 1,
        "vin": [
            {
                "coinbase": "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73",
                "sequence": 4294967295
            }
        ],
        "vout": [
            {
                "value": 175,
                "n": 0,
                "scriptPubKey": {
                    "asm": "04f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446a OP_CHECKSIG",
                    "hex": "4104f5eeb2b10c944c6b9fbcfff94c35bdeecd93df977882babc7f3a2cf7f5c81d3b09a68db7f0e04f21de5d4230e75e6dbe7ad16eefe0d4325a62067dc6f369446aac",
                    "reqSigs": 1,
                    "type": "pubkey",
                    "addresses": [
                        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                    ]
                }
            }
        ],
        "blockhash": "0000000028ce26975b32feda3d75ac3fe10372f75062366cfba4e934dcc6a48b",
        "time": 1570478400,
        "blocktime": 1570478400
    },
    genesisCoinbaseOutputAddressScripthash: "8b01df4e368ea28f8dc0423bcf7a4923e3a12d307c875e47a0cfbf90b5c39161",
    exchangeRateDataUSDT: {
        jsonUrl: "https://exchange-open-api.coineal.com/open/api/get_ticker?symbol=btcvusdt",
        responseBodySelectorFunction: responseBody => {
            if (responseBody.data.last) {
                return responseBody.data.last;
            }
            return null;
        }
    },
    exchangeRateDataBTC: {
        jsonUrl: "https://exchange-open-api.coineal.com/open/api/get_ticker?symbol=btcvbtc",
        responseBodySelectorFunction: responseBody => {
            if (responseBody.data.last) {
                return responseBody.data.last;
            }
            return null;
        }
    },
    exchangeRateDataUSDTUSD: {
        jsonUrl: "https://api.bitfinex.com/v1/pubticker/ustusd",
        responseBodySelectorFunction: responseBody => {
            if (responseBody.last_price) {
                return responseBody.last_price;
            }
            return null;
        }
    },
    exchangeRateDataBTCEUR: {
        jsonUrl: "https://api.bitfinex.com/v1/pubticker/btceur",
        responseBodySelectorFunction: responseBody => {
            if (responseBody.last_price) {
                return responseBody.last_price;
            }
            return null;
        }
    },
    circulatingSupply: {
      jsonUrl: "https://stats.bitcoinvault.global/api/coinmarketcap/circulating_coin_supply",
    },
    blockRewardFunction: blockHeight => {

        if (blockHeight < 29850 + 8 * 26600) {
            if (blockHeight < 29850) return new Decimal8(175);
            if (blockHeight < 29850 + 26600) return new Decimal8(150);
            if (blockHeight < 29850 + 2 * 26600) return new Decimal8(125);
            if (blockHeight < 29850 + 3 * 26600) return new Decimal8(100);
            if (blockHeight < 29850 + 4 * 26600) return new Decimal8(75);
            if (blockHeight < 29850 + 5 * 26600) return new Decimal8(50);
            if (blockHeight < 29850 + 6 * 26600) return new Decimal8(25);
            if (blockHeight < 29850 + 7 * 26600) return new Decimal8(12.5);
            if (blockHeight < 29850 + 8 * 26600) return new Decimal8(6.25);
            return new Decimal8(0);
        }

        blockHeight = blockHeight + (4 * 210000) - (29850 + 8 * 26600);

        let eras = [new Decimal8(50)];
        for (let i = 1; i < 34; i++) {
            let previous = eras[i - 1];
            eras.push(new Decimal8(previous).dividedBy(2));
        }

        let index = Math.floor(blockHeight / 210000);

        return eras[index];
    }
};
