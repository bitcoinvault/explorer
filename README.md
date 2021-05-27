# Bitcoin Vault RPC Explorer

This is a fork of [BTC RPC Explorer](https://github.com/janoside/btc-rpc-explorer) with minor modifications to adapt it to Bitcoin Vault.

---

Simple, database-free Bitcoin Vault blockchain explorer, via RPC. Built with Node.js, express, bootstrap-v4.

This tool is intended to be a simple, self-hosted explorer for the Bitcoin Vault blockchain, driven by RPC calls to your own bvaultd node. This tool is easy to run but currently lacks features compared to database-backed explorers.

Whatever reasons one might have for running a full node (trustlessness, technical curiosity, supporting the network, etc) it's helpful to appreciate the "fullness" of your node. With this explorer, you can not only explore the blockchain (in the traditional sense of the term "explorer"), but also explore the functional capabilities of your own node.

Live demo available at: [https://explorer.bitcoinvault.global](https://explorer.bitcoinvault.global)

# Features

* Browse blocks
* View block details
* View transaction details, with navigation "backward" via spent transaction outputs
* View JSON content used to generate most pages
* Search by transaction ID, block hash/height, and address
* Optional transaction history for addresses by querying from ElectrumX
* Mempool summary, with fee, size, and age breakdowns

# Getting started

The below instructions are geared toward BTCV, but can be adapted easily to other coins.

## Prerequisites

1. Install and run a full, archiving [node](https://github.com/bitcoinvault/bitcoinvault/blob/master/INSTALL.md). Ensure that your bitcoin node has full transaction indexing enabled (`txindex=1`) and the RPC server enabled (`server=1`).
2. Synchronize your node with the Bitcoin Vault network.
3. "Recent" version of Node.js (16+ recommended).

## Instructions

```bash
apt-get install node npm 
git clone https://github.com/bitcoinvault/explorer
cd explorer
npm install
./bin/cli.js
```

If you're running on mainnet with the default datadir and port, this Should Just Work.
Open [http://127.0.0.1:3002/](http://127.0.0.1:3002/) to view the explorer.

You may set configuration options in a `.env` file or using CLI args.
See [configuration](#configuration) for details.

### Configuration

Configuration options may be passed as environment variables
or by creating an env file at `~/.config/btcv-rpc-explorer.env`
or at `.env` in the working directory.
See [.env-sample](.env-sample) for a list of the options and details for formatting `.env`.

In simple cases, you may use the following configuration:

```
BTCEXP_HOST=0.0.0.0
BTCEXP_PORT=80
BTCEXP_PRIVACY_MODE=true
BTCEXP_NO_RATES=true
BTCEXP_UI_SHOW_TOOLS_SUBHEADER=false
```

You may also pass options as CLI arguments, for example:

```bash
./bin/cli.js --port 8080 --bitcoind-port 18443 --bitcoind-cookie ~/.bvault/regtest/.cookie
```

See `./bin/cli.js --help` for the full list of CLI options.

## Run via Docker

1. `docker build -t btcv-rpc-explorer .`
2. `docker run -p 3002:3002 -it btcv-rpc-explorer`

## Local dev environment via docker-compose

1. Prepare `.env` file. If you want setup testnet environment, just copy: `.env-sample`
1. `docker-compose up -d`

# Support

Support the original developer of BTC RPC Explorer by donating BTC to:

* [3NPGpNyLLmVKCEcuipBs7G4KpQJoJXjDGe](bitcoin:3NPGpNyLLmVKCEcuipBs7G4KpQJoJXjDGe)

