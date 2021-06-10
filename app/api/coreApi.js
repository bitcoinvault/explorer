const debug = require("debug");
const debugLog = debug("btcexp:core");
const LRU = require("lru-cache");
const fs = require('fs');
const utils = require("../utils.js");
const config = require("../config.js");
const coins = require("../coins.js");
const redisCache = require("../redisCache.js");
const md5 = require("md5");
const _ = require('lodash');

// choose one of the below: RPC to a node, or mock data while testing
const rpcApi = require("./rpcApi.js");


// this value should be incremented whenever data format changes, to avoid
// pulling old-format data from a persistent cache
const cacheKeyVersion = "v1";

const ONE_SEC = 1000;
const ONE_MIN = 60 * ONE_SEC;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_YEAR = 265 * ONE_DAY;

function createMemoryLruCache(cacheObj, onCacheEvent) {
	return {
		get: key => new Promise((resolve, reject) => {
			onCacheEvent("memory", "try", key);
			var val = cacheObj.get(key);

			if (val != null) {
				onCacheEvent("memory", "hit", key);

			} else {
				onCacheEvent("memory", "miss", key);
			}

			resolve(cacheObj.get(key));
		}),
		set: (key, obj, maxAge) => { cacheObj.set(key, obj, maxAge); }
	}
}

function tryCache(cacheKey, cacheObjs, index, resolve, reject) {
	if (index == cacheObjs.length) {
		resolve(null);

		return;
	}

	cacheObjs[index].get(cacheKey).then(result => {
		if (result != null) {
			resolve(result);

		} else {
			tryCache(cacheKey, cacheObjs, index + 1, resolve, reject);
		}
	});
}

function createTieredCache(cacheObjs) {
	return {
		get: key => new Promise((resolve, reject) => {
			tryCache(key, cacheObjs, 0, resolve, reject);
		}),
		set: (key, obj, maxAge) => {
			for (var i = 0; i < cacheObjs.length; i++) {
				cacheObjs[i].set(key, obj, maxAge);
			}
		}
	}
}

let miscCaches = [];
let blockCaches = [];
let txCaches = [];

if (!config.noInmemoryRpcCache) {
	global.cacheStats.memory = {
		try: 0,
		hit: 0,
		miss: 0
	};

	var onMemoryCacheEvent = (cacheType, eventType, cacheKey) => {
		global.cacheStats.memory[eventType]++;
	}

	miscCaches.push(createMemoryLruCache(new LRU(2000), onMemoryCacheEvent));
	blockCaches.push(createMemoryLruCache(new LRU(2000), onMemoryCacheEvent));
	txCaches.push(createMemoryLruCache(new LRU(10000), onMemoryCacheEvent));
}

if (redisCache.active) {
	global.cacheStats.redis = {
		try: 0,
		hit: 0,
		miss: 0,
		error: 0
	};

	const onRedisCacheEvent = (cacheType, eventType, cacheKey) => {
		global.cacheStats.redis[eventType]++;
	}

	// md5 of the active RPC credentials serves as part of the key; this enables
	// multiple instances of btc-rpc-explorer (eg mainnet + testnet) to share
	// a single redis instance peacefully
	const rpcHostPort = `${config.credentials.rpc.host}:${config.credentials.rpc.port}`;
	const rpcCredKeyComponent = md5(JSON.stringify(`${rpcHostPort}${config.credentials.rpc}`)).substring(0, 8);

	const redisCacheObj = redisCache.createCache(`${cacheKeyVersion}-${rpcCredKeyComponent}`, onRedisCacheEvent);

	miscCaches.push(redisCacheObj);
	blockCaches.push(redisCacheObj);
	txCaches.push(redisCacheObj);
}

const miscCache = createTieredCache(miscCaches);
const blockCache = createTieredCache(blockCaches);
const txCache = createTieredCache(txCaches);

function getGenesisBlockHash() {
	return coins[config.coin].genesisBlockHash;
}

function getGenesisCoinbaseTransactionId() {
	return coins[config.coin].genesisCoinbaseTransactionId;
}

function tryCacheThenRpcApi(cache, cacheKey, cacheMaxAge, rpcApiFunction, cacheConditionFunction) {
	if (cacheConditionFunction == null) {
		cacheConditionFunction = obj => true;
	}

	return new Promise((resolve, reject) => {
		let cacheResult = null;

		const finallyFunc = () => {
			if (cacheResult != null) {
				resolve(cacheResult);

			} else {
				rpcApiFunction().then(rpcResult => {
					if (rpcResult != null && cacheConditionFunction(rpcResult)) {
						cache.set(cacheKey, rpcResult, cacheMaxAge);
					}

					resolve(rpcResult);

				}).catch(err => {
					reject(err);
				});
			}
		};

		cache.get(cacheKey).then(result => {
			cacheResult = result;

			finallyFunc();

		}).catch(err => {
			utils.logError("nds9fc2eg621tf3", err, {cacheKey});

			finallyFunc();
		});
	});
}

function shouldCacheTransaction(tx) {
	if (!tx.confirmations) {
		return false;
	}

	if (tx.confirmations < 1) {
		return false;
	}

	// return !(tx.vin != null && tx.vin.length > 9);
	return true;
}

function getBlockchainInfo() {
	return tryCacheThenRpcApi(miscCache, "getBlockchainInfo", 10 * ONE_SEC, rpcApi.getBlockchainInfo);
}

function getNetworkInfo() {
	return tryCacheThenRpcApi(miscCache, "getNetworkInfo", 10 * ONE_SEC, rpcApi.getNetworkInfo);
}

function getNetTotals() {
	return tryCacheThenRpcApi(miscCache, "getNetTotals", 10 * ONE_SEC, rpcApi.getNetTotals);
}

function getMempoolInfo() {
	return tryCacheThenRpcApi(miscCache, "getMempoolInfo", 5 * ONE_SEC, rpcApi.getMempoolInfo);
}

function getMempoolTxids() {
	// no caching, that would be dumb
	return rpcApi.getMempoolTxids();
}

function getMiningInfo() {
	return tryCacheThenRpcApi(miscCache, "getMiningInfo", 30 * ONE_SEC, rpcApi.getMiningInfo);
}

function getUptimeSeconds() {
	return tryCacheThenRpcApi(miscCache, "getUptimeSeconds", ONE_SEC, rpcApi.getUptimeSeconds);
}

function getChainTxStats(blockCount) {
	return tryCacheThenRpcApi(miscCache, "getChainTxStats-" + blockCount, 20 * ONE_MIN, () => rpcApi.getChainTxStats(blockCount));
}

function getNetworkHashrate(blockCount) {
	return tryCacheThenRpcApi(miscCache, "getNetworkHashrate-" + blockCount, 20 * ONE_MIN, () => rpcApi.getNetworkHashrate(blockCount));
}

function getBlockStats(hash) {
	return tryCacheThenRpcApi(miscCache, "getBlockStats-" + hash, ONE_YR, () => rpcApi.getBlockStats(hash));
}

function getBlockStatsByHeight(height) {
	return tryCacheThenRpcApi(miscCache, "getBlockStatsByHeight-" + height, ONE_YR, () => rpcApi.getBlockStatsByHeight(height));
}

function getUtxoSetSummary() {
	return tryCacheThenRpcApi(miscCache, "getUtxoSetSummary", 15 * ONE_MIN, rpcApi.getUtxoSetSummary);
}

function getTxCountStats(dataPtCount, blockStart, blockEnd) {
	return new Promise((resolve, reject) => {
		var dataPoints = dataPtCount;

		getBlockchainInfo().then(getblockchaininfo => {
			if (typeof blockStart === "string") {
				if (["genesis", "first", "zero"].includes(blockStart)) {
					blockStart = 0;
				}
			}

			if (typeof blockEnd === "string") {
				if (["latest", "tip", "newest"].includes(blockEnd)) {
					blockEnd = getblockchaininfo.blocks;
				}
			}

			if (blockStart > blockEnd) {
				reject(`Error 37rhw0e7ufdsgf: blockStart (${blockStart}) > blockEnd (${blockEnd})`);

				return;
			}

			if (blockStart < 0) {
				blockStart += getblockchaininfo.blocks;
			}

			if (blockEnd < 0) {
				blockEnd += getblockchaininfo.blocks;
			}

			var chainTxStatsIntervals = [];
			for (var i = 0; i < dataPoints; i++) {
				chainTxStatsIntervals.push(parseInt(Math.max(10, getblockchaininfo.blocks - blockStart - i * (blockEnd - blockStart) / (dataPoints - 1) - 1)));
			}

			var promises = [];
			for (var i = 0; i < chainTxStatsIntervals.length; i++) {
				promises.push(getChainTxStats(chainTxStatsIntervals[i]));
			}

			Promise.all(promises).then(results => {
				if (results[0].name == "RpcError" && results[0].code == -8) {
					// recently started node - no meaningful data to return
					resolve(null);

					return;
				}

				var txStats = {
					txCounts: [],
					txLabels: [],
					txRates: []
				};

				for (var i = results.length - 1; i >= 0; i--) {
					if (results[i].window_tx_count) {
						txStats.txCounts.push( {x:(getblockchaininfo.blocks - results[i].window_block_count), y: (results[i].txcount - results[i].window_tx_count)} );
						txStats.txRates.push( {x:(getblockchaininfo.blocks - results[i].window_block_count), y: (results[i].txrate)} );
						txStats.txLabels.push(i);
					}
				}

				resolve({txCountStats:txStats, getblockchaininfo, totalTxCount:results[0].txcount});

			}).catch(err => {
				reject(err);
			});

		}).catch(err => {
			reject(err);
		});
	});
}

function getSmartFeeEstimates(mode, confTargetBlockCounts) {
	return new Promise((resolve, reject) => {
		var promises = [];
		for (var i = 0; i < confTargetBlockCounts.length; i++) {
			promises.push(getSmartFeeEstimate(mode, confTargetBlockCounts[i]));
		}

		Promise.all(promises).then(results => {
			resolve(results);

		}).catch(err => {
			reject(err);
		});
	});
}

function getSmartFeeEstimate(mode, confTargetBlockCount) {
	return tryCacheThenRpcApi(miscCache, "getSmartFeeEstimate-" + mode + "-" + confTargetBlockCount, 5 * ONE_MIN, () => rpcApi.getSmartFeeEstimate(mode, confTargetBlockCount));
}

function getPeerSummary() {
	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "getpeerinfo", ONE_SEC, rpcApi.getPeerInfo).then(getpeerinfo => {
			var result = {};
			result.getpeerinfo = getpeerinfo;

			var versionSummaryMap = {};
			for (var i = 0; i < getpeerinfo.length; i++) {
				var x = getpeerinfo[i];

				if (versionSummaryMap[x.subver] == null) {
					versionSummaryMap[x.subver] = 0;
				}

				versionSummaryMap[x.subver]++;
			}

			var versionSummary = [];
			for (var prop in versionSummaryMap) {
				if (versionSummaryMap.hasOwnProperty(prop)) {
					versionSummary.push([prop, versionSummaryMap[prop]]);
				}
			}

			versionSummary.sort((a, b) => {
				if (b[1] > a[1]) {
					return 1;

				} else if (b[1] < a[1]) {
					return -1;

				} else {
					return a[0].localeCompare(b[0]);
				}
			});



			var servicesSummaryMap = {};
			for (var i = 0; i < getpeerinfo.length; i++) {
				var x = getpeerinfo[i];

				if (servicesSummaryMap[x.services] == null) {
					servicesSummaryMap[x.services] = 0;
				}

				servicesSummaryMap[x.services]++;
			}

			var servicesSummary = [];
			for (var prop in servicesSummaryMap) {
				if (servicesSummaryMap.hasOwnProperty(prop)) {
					servicesSummary.push([prop, servicesSummaryMap[prop]]);
				}
			}

			servicesSummary.sort((a, b) => {
				if (b[1] > a[1]) {
					return 1;

				} else if (b[1] < a[1]) {
					return -1;

				} else {
					return a[0].localeCompare(b[0]);
				}
			});



			result.versionSummary = versionSummary;
			result.servicesSummary = servicesSummary;

			resolve(result);

		}).catch(err => {
			reject(err);
		});
	});
}

function getMempoolDetails(start, count) {
	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "getMempoolTxids", ONE_SEC, rpcApi.getMempoolTxids).then(resultTxids => {
			var txids = [];

			for (var i = start; (i < resultTxids.length && i < (start + count)); i++) {
				txids.push(resultTxids[i]);
			}

			getRawTransactionsWithInputs(txids, config.site.txMaxInput).then(result => {
				resolve({ txCount:resultTxids.length, transactions:result.transactions, txInputsByTransaction:result.txInputsByTransaction });
			});

		}).catch(err => {
			reject(err);
		});
	});
}
// function getMempoolDetails(start, count) {
// 	return new Promise(function(resolve, reject) {
// 		tryCacheThenRpcApi(miscCache, "getRawMempool", ONE_SEC, rpcApi.getRawMempool).then(function(result) {
// 			var txids = [];
// 			var txidIndex = 0;
// 			for (var txid in result) {
// 				if (txidIndex >= start && (txidIndex < (start + count)))  {
// 					txids.push(txid);
// 				}
//
// 				txidIndex++;
// 			}
//
// 			getRawTransactions(txids).then(function(transactions) {
// 				var maxInputsTracked = config.site.txMaxInput;
// 				var vinTxids = [];
// 				for (var i = 0; i < transactions.length; i++) {
// 					var transaction = transactions[i];
//
// 					if (transaction && transaction.vin) {
// 						for (var j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
// 							if (transaction.vin[j].txid) {
// 								vinTxids.push(transaction.vin[j].txid);
// 							}
// 						}
// 					}
// 				}
//
// 				var txInputsByTransaction = {};
// 				getRawTransactions(vinTxids).then(function(vinTransactions) {
// 					var vinTxById = {};
//
// 					vinTransactions.forEach(function(tx) {
// 						vinTxById[tx.txid] = tx;
// 					});
//
// 					transactions.forEach(function(tx) {
// 						txInputsByTransaction[tx.txid] = {};
//
// 						if (tx && tx.vin) {
// 							for (var i = 0; i < Math.min(maxInputsTracked, tx.vin.length); i++) {
// 								if (vinTxById[tx.vin[i].txid]) {
// 									txInputsByTransaction[tx.txid][i] = vinTxById[tx.vin[i].txid];
// 								}
// 							}
// 						}
// 					});
//
// 					resolve({ txCount:txidIndex, transactions:transactions, txInputsByTransaction:txInputsByTransaction });
// 				}).catch(function(err) {
// 					reject(err);
// 				});
//
// 			}).catch(function(err) {
// 				reject(err);
// 			});
//
// 		}).catch(function(err) {
// 			reject(err);
// 		});
// 	});
// }

function getMempoolStats() {
	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "getRawMempool", 5000, rpcApi.getRawMempool).then(result => {
			var maxFee = 0;
			var maxFeePerByte = 0;
			var maxAge = 0;
			var maxSize = 0;
			var ages = [];
			var sizes = [];
			for (var txid in result) {
				var txMempoolInfo = result[txid];
				var fee = txMempoolInfo.modifiedfee;
				var feePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.vsize;
				var age = Date.now() / 1000 - txMempoolInfo.time;
				var size = txMempoolInfo.vsize;

				if (fee > maxFee) {
					maxFee = txMempoolInfo.modifiedfee;
				}

				if (feePerByte > maxFeePerByte) {
					maxFeePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.vsize;
				}

				ages.push({age, txid});
				sizes.push({size, txid});

				if (age > maxAge) {
					maxAge = age;
				}

				if (size > maxSize) {
					maxSize = size;
				}
			}

			ages.sort((a, b) => {
				if (a.age != b.age) {
					return b.age - a.age;

				} else {
					return a.txid.localeCompare(b.txid);
				}
			});

			sizes.sort((a, b) => {
				if (a.size != b.size) {
					return b.size - a.size;

				} else {
					return a.txid.localeCompare(b.txid);
				}
			});

			maxSize = 2000;

			var satoshiPerByteBucketMaxima = coins[config.coin].feeSatoshiPerByteBucketMaxima;
			var bucketCount = satoshiPerByteBucketMaxima.length + 1;

			var satoshiPerByteBuckets = [];
			var satoshiPerByteBucketLabels = [];

			satoshiPerByteBucketLabels[0] = ("[0 - " + satoshiPerByteBucketMaxima[0] + ")");
			for (var i = 0; i < bucketCount; i++) {
				satoshiPerByteBuckets[i] = {"count":0, "totalFees":0, "totalBytes":0};

				if (i > 0 && i < bucketCount - 1) {
					satoshiPerByteBucketLabels[i] = ("[" + satoshiPerByteBucketMaxima[i - 1] + " - " + satoshiPerByteBucketMaxima[i] + ")");
				}
			}

			var ageBucketCount = 100;
			var ageBucketTxCounts = [];
			var ageBucketLabels = [];

			var sizeBucketCount = 100;
			var sizeBucketTxCounts = [];
			var sizeBucketLabels = [];

			for (var i = 0; i < ageBucketCount; i++) {
				ageBucketTxCounts.push(0);
				ageBucketLabels.push(parseInt(i * maxAge / ageBucketCount) + " - " + parseInt((i + 1) * maxAge / ageBucketCount));
			}

			for (var i = 0; i < sizeBucketCount; i++) {
				sizeBucketTxCounts.push(0);

				if (i == sizeBucketCount - 1) {
					sizeBucketLabels.push(parseInt(i * maxSize / sizeBucketCount) + "+");

				} else {
					sizeBucketLabels.push(parseInt(i * maxSize / sizeBucketCount) + " - " + parseInt((i + 1) * maxSize / sizeBucketCount));
				}
			}

			satoshiPerByteBucketLabels[bucketCount - 1] = (satoshiPerByteBucketMaxima[satoshiPerByteBucketMaxima.length - 1] + "+");

			var summary = {
				"count":0,
				"totalFees":0,
				"totalBytes":0,
				satoshiPerByteBuckets,
				satoshiPerByteBucketLabels,
				ageBucketTxCounts,
				ageBucketLabels,
				sizeBucketTxCounts,
				sizeBucketLabels
			};

			for (var txid in result) {
				var txMempoolInfo = result[txid];
				var fee = txMempoolInfo.modifiedfee;
				var feePerByte = txMempoolInfo.modifiedfee / txMempoolInfo.vsize;
				var satoshiPerByte = feePerByte * 100000000;
				var age = Date.now() / 1000 - txMempoolInfo.time;
				var size = txMempoolInfo.vsize;

				var addedToBucket = false;
				for (var i = 0; i < satoshiPerByteBucketMaxima.length; i++) {
					if (satoshiPerByteBucketMaxima[i] > satoshiPerByte) {
						satoshiPerByteBuckets[i]["count"]++;
						satoshiPerByteBuckets[i]["totalFees"] += fee;
						satoshiPerByteBuckets[i]["totalBytes"] += txMempoolInfo.vsize;

						addedToBucket = true;

						break;
					}
				}

				if (!addedToBucket) {
					satoshiPerByteBuckets[bucketCount - 1]["count"]++;
					satoshiPerByteBuckets[bucketCount - 1]["totalFees"] += fee;
					satoshiPerByteBuckets[bucketCount - 1]["totalBytes"] += txMempoolInfo.vsize;
				}

				summary["count"]++;
				summary["totalFees"] += txMempoolInfo.modifiedfee;
				summary["totalBytes"] += txMempoolInfo.vsize;

				var ageBucketIndex = Math.min(ageBucketCount - 1, parseInt(age / (maxAge / ageBucketCount)));
				var sizeBucketIndex = Math.min(sizeBucketCount - 1, parseInt(size / (maxSize / sizeBucketCount)));

				ageBucketTxCounts[ageBucketIndex]++;
				sizeBucketTxCounts[sizeBucketIndex]++;
			}
			const averageFeePerByte = summary["totalFees"] / summary["totalBytes"];

			summary["averageFee"] = summary["totalFees"] / summary["count"];
			summary["averageFeePerByte"] = isNaN(averageFeePerByte) ? 0 : averageFeePerByte;

			summary["satoshiPerByteBucketMaxima"] = satoshiPerByteBucketMaxima;
			summary["satoshiPerByteBucketCounts"] = [];
			summary["satoshiPerByteBucketTotalFees"] = [];

			for (var i = 0; i < bucketCount; i++) {
				summary["satoshiPerByteBucketCounts"].push(summary["satoshiPerByteBuckets"][i]["count"]);
				summary["satoshiPerByteBucketTotalFees"].push(summary["satoshiPerByteBuckets"][i]["totalFees"]);
			}

			/*debugLog(JSON.stringify(ageBuckets));
			debugLog(JSON.stringify(ageBucketLabels));
			debugLog(JSON.stringify(sizeBuckets));
			debugLog(JSON.stringify(sizeBucketLabels));*/

			resolve(summary);

		}).catch(err => {
			reject(err);
		});
	});
}

function getBlockByHeight(blockHeight) {
	return tryCacheThenRpcApi(blockCache, "getBlockByHeight-" + blockHeight, 3600000, () => rpcApi.getBlockByHeight(blockHeight));
}

function getBlocksByHeight(blockHeights) {
	return new Promise((resolve, reject) => {
		var promises = [];
		for (var i = 0; i < blockHeights.length; i++) {
			promises.push(getBlockByHeight(blockHeights[i]));
		}

		Promise.all(promises).then(results => {
			resolve(results);

		}).catch(err => {
			reject(err);
		});
	});
}

function getBlockByHash(blockHash) {
	return tryCacheThenRpcApi(blockCache, "getBlockByHash-" + blockHash, 3600000, () => rpcApi.getBlockByHash(blockHash));
}

function getBlocksByHash(blockHashes) {
	return new Promise((resolve, reject) => {
		var promises = [];
		for (var i = 0; i < blockHashes.length; i++) {
			promises.push(getBlockByHash(blockHashes[i]));
		}

		Promise.all(promises).then(results => {
			var result = {};

			results.forEach(item => {
				result[item.hash] = item;
			});

			resolve(result);

		}).catch(err => {
			reject(err);
		});
	});
}

function getRawTransaction(txid) {
	const rpcApiFunction = () => rpcApi.getRawTransaction(txid);

	return tryCacheThenRpcApi(txCache, "getRawTransaction-" + txid, ONE_DAY, rpcApiFunction, shouldCacheTransaction);
}

function getTxUtxos(tx) {
	return new Promise((resolve, reject) => {
		var promises = [];

		for (var i = 0; i < tx.vout.length; i++) {
			promises.push(getUtxo(tx.txid, i));
		}

		Promise.all(promises).then(results => {
			resolve(results);

		}).catch(err => {
			reject(err);
		});
	});
}

function getUtxo(txid, outputIndex) {
	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "utxo-" + txid + "-" + outputIndex, 3600000, () => rpcApi.getUtxo(txid, outputIndex)).then(result => {
			// to avoid cache misses, rpcApi.getUtxo returns "0" instead of null
			if (result == "0") {
				resolve(null);

				return;
			}

			resolve(result);
		}).catch(err => {
			reject(err);
		});
	});
}

function getMempoolTxDetails(txid) {
	return tryCacheThenRpcApi(miscCache, "mempoolTxDetails-" + txid, 3600000, () => rpcApi.getMempoolTxDetails(txid));
}

function getAddress(address) {
	return tryCacheThenRpcApi(miscCache, "getAddress-" + address, 3600000, () => rpcApi.getAddress(address));
}

function getRawTransactions(txids) {
	return new Promise((resolve, reject) => {
		let promises = [];

		let uniqTxids = _.uniq(txids)

		for (let i = 0; i < uniqTxids.length; i++) {
			promises.push(getRawTransaction(uniqTxids[i]));
		}

		Promise.all(promises).then(results => {
			let txInputs = _.keyBy(results, 'txid')
			let txInputsReturn = [];

			_.forEach(txids, id => {
				txInputsReturn.push(txInputs[id])
			})

			resolve(txInputsReturn);
		}).catch(err => {
			reject(err);
		});
	});
}

function getRawTransactionsWithInputs(txids, maxInputs=-1) {
	return new Promise((resolve, reject) => {
		getRawTransactions(txids).then(transactions => {
			var maxInputsTracked = config.site.txMaxInput;

			if (maxInputs <= 0) {
				maxInputsTracked = 1000000;

			} else if (maxInputs > 0) {
				maxInputsTracked = maxInputs;
			}

			var vinTxids = [];
			for (var i = 0; i < transactions.length; i++) {
				var transaction = transactions[i];

				if (transaction && transaction.vin) {
					for (var j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
						if (transaction.vin[j].txid) {
							vinTxids.push(transaction.vin[j].txid);
						}
					}
				}
			}

			var txInputsByTransaction = {};
			getRawTransactions(vinTxids).then(vinTransactions => {
				var vinTxById = {};

				vinTransactions.forEach(tx => {
					vinTxById[tx.txid] = tx;
				});

				transactions.forEach(tx => {
					txInputsByTransaction[tx.txid] = {};

					if (tx && tx.vin) {
						for (var i = 0; i < Math.min(maxInputsTracked, tx.vin.length); i++) {
							if (vinTxById[tx.vin[i].txid]) {
								txInputsByTransaction[tx.txid][i] = vinTxById[tx.vin[i].txid];
							}
						}
					}
				});

				resolve({transactions, txInputsByTransaction});
			});
		});
	});
}

function getBlockByHashWithTransactions(blockHash, txLimit, txOffset) {
	return new Promise((resolve, reject) => {
		getBlockByHash(blockHash).then(block => {
			var txids = [];

			if (txOffset > 0) {
				txids.push(block.tx[0]);
			}

			for (var i = txOffset; i < Math.min(txOffset + txLimit, block.tx.length); i++) {
				txids.push(block.tx[i]);
			}

			getRawTransactions(txids).then(transactions => {
				if (transactions.length == txids.length) {
					block.coinbaseTx = transactions[0];
					block.totalFees = utils.getBlockTotalFeesFromCoinbaseTxAndBlockHeight(block.coinbaseTx, block.height);
					block.miner = utils.getMinerFromCoinbaseTx(block.coinbaseTx);
				}

				// if we're on page 2, we don't really want it anymore...
				if (txOffset > 0) {
					transactions.shift();
				}

				var maxInputsTracked = config.site.txMaxInput;
				var vinTxids = [];
				for (var i = 0; i < transactions.length; i++) {
					var transaction = transactions[i];

					if (transaction && transaction.vin) {
						for (var j = 0; j < Math.min(maxInputsTracked, transaction.vin.length); j++) {
							if (transaction.vin[j].txid) {
								vinTxids.push(transaction.vin[j].txid);
							}
						}
					}
				}

				var txInputsByTransaction = {};
				getRawTransactions(vinTxids).then(vinTransactions => {
					var vinTxById = {};

					vinTransactions.forEach(tx => {
						vinTxById[tx.txid] = tx;
					});

					transactions.forEach(tx => {
						txInputsByTransaction[tx.txid] = {};

						if (tx && tx.vin) {
							for (var i = 0; i < Math.min(maxInputsTracked, tx.vin.length); i++) {
								if (vinTxById[tx.vin[i].txid]) {
									txInputsByTransaction[tx.txid][i] = vinTxById[tx.vin[i].txid];
								}
							}
						}

						resolve({ getblock:block, transactions, txInputsByTransaction});
					});
				});
			});
		});
	});
}

function getHelp() {
	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "getHelp", 3600000, rpcApi.getHelp).then(helpContent => {
			var lines = helpContent.split("\n");
			var sections = [];

			lines.forEach(line => {
				if (line.startsWith("==")) {
					var sectionName = line.substring(2);
					sectionName = sectionName.substring(0, sectionName.length - 2).trim();

					sections.push({name:sectionName, methods:[]});

				} else if (line.trim().length > 0) {
					var methodName = line.trim();

					if (methodName.includes(" ")) {
						methodName = methodName.substring(0, methodName.indexOf(" "));
					}

					sections[sections.length - 1].methods.push({name:methodName, content:line.trim()});
				}
			});

			resolve(sections);

		}).catch(err => {
			reject(err);
		});
	});
}

function getRpcMethodHelp(methodName) {
	var rpcApiFunction = () => rpcApi.getRpcMethodHelp(methodName);

	return new Promise((resolve, reject) => {
		tryCacheThenRpcApi(miscCache, "getHelp-" + methodName, 3600000, rpcApiFunction).then(helpContent => {
			var output = {};
			output.string = helpContent;

			var str = helpContent;

			var lines = str.split("\n");
			var argumentLines = [];
			var catchArgs = false;
			lines.forEach(line => {
				if (line.trim().length == 0) {
					catchArgs = false;
				}

				if (catchArgs) {
					argumentLines.push(line);
				}

				if (line.trim() == "Arguments:" || line.trim() == "Arguments") {
					catchArgs = true;
				}
			});

			var args = [];
			var argX = null;
			// looking for line starting with "N. " where N is an integer (1-2 digits)
			argumentLines.forEach(line => {
				var regex = /^([0-9]+)\.\s*"?(\w+)"?\s*\(([^,)]*),?\s*([^,)]*),?\s*([^,)]*),?\s*([^,)]*)?\s*\)\s*(.+)?$/;

				var match = regex.exec(line);

				if (match) {
					argX = {};
					argX.name = match[2];
					argX.detailsLines = [];

					argX.properties = [];

					if (match[3]) {
						argX.properties.push(match[3]);
					}

					if (match[4]) {
						argX.properties.push(match[4]);
					}

					if (match[5]) {
						argX.properties.push(match[5]);
					}

					if (match[6]) {
						argX.properties.push(match[6]);
					}

					if (match[7]) {
						argX.description = match[7];
					}

					args.push(argX);
				}

				if (!match && argX) {
					argX.detailsLines.push(line);
				}
			});

			output.args = args;

			resolve(output);

		}).catch(err => {
			reject(err);
		});
	});
}

function logCacheSizes() {
	var itemCounts = [ miscCache.itemCount, blockCache.itemCount, txCache.itemCount ];

	var stream = fs.createWriteStream("memoryUsage.csv", {flags:'a'});
	stream.write("itemCounts: " + JSON.stringify(itemCounts) + "\n");
	stream.end();
}

module.exports = {
	getGenesisBlockHash,
	getGenesisCoinbaseTransactionId,
	getBlockchainInfo,
	getNetworkInfo,
	getNetTotals,
	getMempoolInfo,
	getMiningInfo,
	getBlockByHeight,
	getBlocksByHeight,
	getBlockByHash,
	getBlocksByHash,
	getBlockByHashWithTransactions,
	getRawTransaction,
	getRawTransactions,
	getRawTransactionsWithInputs,
	getTxUtxos,
	getMempoolTxDetails,
	getMempoolStats,
	getUptimeSeconds,
	getHelp,
	getRpcMethodHelp,
	getAddress,
	logCacheSizes,
	getPeerSummary,
	getChainTxStats,
	getMempoolDetails,
	getMempoolTxids,
	getTxCountStats
};