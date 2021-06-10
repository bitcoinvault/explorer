#!/usr/bin/env node

const args = require('meow')(`
    Usage
      $ btcv-rpc-explorer [options]

    Options
      -p, --port <port>              port to bind http server [default: 3002]
      -i, --host <host>              host to bind http server [default: 127.0.0.1]
      -a, --basic-auth-password <..> protect web interface with a password [default: no password]
      -C, --coin <coin>              crypto-coin to enable [default: BTCV]

      -b, --bitcoind-uri <uri>       connection URI for bvaultd rpc (overrides the options below)
      -H, --bitcoind-host <host>     hostname for bvaultd rpc [default: 127.0.0.1]
      -P, --bitcoind-port <port>     port for bvaultd rpc [default: 8332]
      -c, --bitcoind-cookie <path>   path to bvaultd cookie file [default: ~/.bitcoin/.cookie]
      -u, --bitcoind-user <user>     username for bvaultd rpc [default: none]
      -w, --bitcoind-pass <pass>     password for bvaultd rpc [default: none]

      --address-api <option>         api to use for address queries (options: electrumx, blockchain.com, blockchair.com, blockcypher.com) [default: none]
      -E, --electrumx-servers <..>   comma separated list of electrum servers to use for address queries; only used if --address-api=electrumx [default: none]

      --rpc-allowall                 allow all rpc commands [default: false]
      --rpc-blacklist <methods>      comma separated list of rpc commands to block [default: see in config.js]
      --cookie-secret <secret>       secret key for signed cookie hmac generation [default: hmac derive from bitcoind pass]
      --no-rates                     disable fetching of currency exchange rates [default: enabled]
      --privacy-mode                 enable privacyMode to disable external data requests [default: disabled]
      --max-mem <bytes>              value for max_old_space_size [default: 1024 (1 GB)]

      --ganalytics-tracking <tid>    tracking id for google analytics [default: disabled]
      --sentry-url <sentry-url>      sentry url [default: disabled]

      -e, --node-env <env>           nodejs environment mode [default: production]
      -h, --help                     output usage information
      -v, --version                  output version number

    Examples
      $ btcv-rpc-explorer --port 8080 --bitcoind-port 18443 --bitcoind-cookie ~/.bvault/regtest/.cookie
      $ btcv-rpc-explorer -p 8080 -P 18443 -c ~/.bvault/regtest.cookie

    Or using connection URIs
      $ btcv-rpc-explorer -b bitcoin://bob:myPassword@127.0.0.1:18443/
      $ btcv-rpc-explorer -b bitcoin://127.0.0.1:18443/?cookie=$HOME/.bvault/regtest/.cookie

    All options may also be specified as environment variables
      $ BTCEXP_PORT=8080 BTCEXP_BITCOIND_PORT=18443 BTCEXP_BITCOIND_COOKIE=~/.bvault/regtest/.cookie btcv-rpc-explorer


`, { flags: { port: {alias:'p'}, host: {alias:'i'}, basicAuthPassword: {alias:'a'}, coin: {alias:'C'}
            , bitcoindUri: {alias:'b'}, bitcoindHost: {alias:'H'}, bitcoindPort: {alias:'P'}
            , bitcoindCookie: {alias:'c'}, bitcoindUser: {alias:'u'}, bitcoindPass: {alias:'w'}
            , demo: {type:'boolean'}, rpcAllowall: {type:'boolean'}, electrumxServers: {alias:'E'}
            , enableInfluxdb: {type:'boolean'}, nodeEnv: {alias:'e', default:'production'}
            , privacyMode: {type:'boolean'}
            } }
).flags;

const envify = k => k.replace(/([A-Z])/g, '_$1').toUpperCase();

Object.keys(args).filter(k => k.length > 1).forEach(k => {
  if (args[k] === false) process.env[`BTCEXP_NO_${envify(k)}`] = true;
  else process.env[`BTCEXP_${envify(k)}`] = args[k];
})

require('./www');
