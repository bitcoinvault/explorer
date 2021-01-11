const blockheight = {
  details: {
    jsonTab: '.nav-tabs > :nth-child(2) > .nav-link',
    detailsTab: '.nav-tabs > :nth-child(1) > .nav-link',
    hash: '.h3 > .word-wrap',
    txid: '.card-header > a',
  },
  jsonTab: {
    blockHeight: '#tab-json-block-summary > pre > .json > :nth-child(12)',
    hash: '#tab-json-block-summary > pre > .json > :nth-child(2)',
    txid: ':nth-child(2) > pre > .json > :nth-child(2)',
  },
};

export default blockheight;
