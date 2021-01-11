const homepage = {
  header: {
    header: '.navbar-brand > :nth-child(1) > span',
    logo: '.header-image',
    searchBar: '.form-control',
    navBar: '#navbarDropdown',
    navlist: ':nth-child(3) > .nav-item > .dropdown-menu',
    searchButton: '.input-group-append > .btn > .svg-inline--fa',
    noResultAlert: '.alert',
  },
  footer: {
    sourceLink: 'dd > a',
  },
  networkSummary: {
    tools: '.nav-link > span',
    hashrate: ':nth-child(1) > .lead',
    difficulty: ':nth-child(5) > .lead',
    coinsinCirculation: ':nth-child(9) > .lead',
    totalTx: ':nth-child(2) > .lead',
    blockchainSize: ':nth-child(6) > .lead',
    marketCap: ':nth-child(10) > .lead',
    unconfirmedTx: ':nth-child(3) > .lead',
    numberOfWallet: ':nth-child(7) > .lead',
    exchangeRateUsd: ':nth-child(11) > .lead',
    chainwork: ':nth-child(4) > .lead',
    volume: ':nth-child(8) > .lead',
    exchangeRateBtc: ':nth-child(12) > .lead',
  },
  tools: {
    nodeStatus: ':nth-child(1) > .pl-0 > :nth-child(1) > a',
    Peers: ':nth-child(1) > .pl-0 > :nth-child(2) > a',
    BrowseBlocks: ':nth-child(1) > .pl-0 > :nth-child(3) > a',
    mempoolSummary: ':nth-child(2) > .pl-0 > :nth-child(1) > a',
    txStats: ':nth-child(2) > .pl-0 > :nth-child(2) > a',
    unconfirmedtransactions: ':nth-child(2) > .pl-0 > :nth-child(3) > a',
    rpcBrowser: ':nth-child(3) > .pl-0 > :nth-child(1) > a',
    hashrateDist: ':nth-child(3) > .pl-0 > :nth-child(2) > a',
  },
  units: {
    units: ':nth-child(1n+0) > :nth-child(6) > .monospace > .border-dotted',
  },
  navbarTheme: {
    light: '[href="/changeSetting?name=uiTheme&value=light"] > span',
    dark: '[href="/changeSetting?name=uiTheme&value=dark"] > span',
  },
  latestBlocks: {
    height:
      '.table-striped > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(1) > a:nth-child(1)',
  },
};

export default homepage;
