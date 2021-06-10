const express = require('express');
const utils = require('./../../app/utils.js');
const aboutPage = express.Router();
const coinDistributionPage = express.Router();
const richestWalletsPage = express.Router();

aboutPage.get("/", (req, res) => {
    res.render("about");
});

coinDistributionPage.get("/", (req, res) => {
    res.render("coin-distribution");
});

richestWalletsPage.get("/", (req, res, next) => {
    utils.getRichestWallets().then(results => {
        global.richestWallets = results;

        res.render("richest-wallets");
    });
});

module.exports = {
    aboutPage,
    coinDistributionPage,
    richestWalletsPage,
}