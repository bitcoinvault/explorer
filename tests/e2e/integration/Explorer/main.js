import homepage from '../../support/pages/homepage';
import blockheight from '../../support/pages/blockheight';
import devices from '../../support/devices';

devices.forEach((device) => {
  describe('Explorer autotest', () => {

    describe(`Testing on device: ${device.model}`, () => {
      beforeEach(() => {
        cy.viewport(device.width, device.height);
        cy.visit('/');
      });

      describe('Explorer server status check', () => {
        it('Should assert status = OK', () => {
          cy.request("/").should((response) => {
            expect(response.status).to.eq(200);
          });
        });
      });

      describe('Explorer header presenting', () => {
        it('should display header', () => {
          cy.get(homepage.header.header)
            .should('be.visible')
            .invoke('text')
            .and('include', 'Bitcoin Vault Explorer');
        });

        it('should display header', () => {
          cy.get(homepage.header.logo).should('be.visible');
        });

        it('should display searchbar', () => {
          cy.get(homepage.header.searchBar).should('be.visible');
        });

        it('should display navigation bar', () => {
          cy.get(homepage.header.navBar).should('be.visible');
        });
      });

      describe('Explorer footer presenting', () => {
        it('should assert source link visibility & url', () => {
          cy.get(homepage.footer.sourceLink)
            .should('be.visible')
            .invoke('attr', 'href')
            .should('be.eq', Cypress.env('source'));
        });
      });

      describe('Explorer data presenting', () => {
        it('should display hashrate', () => {
          cy.get(homepage.networkSummary.hashrate).should('be.visible');
        });

        it('should display difficulty', () => {
          cy.get(homepage.networkSummary.difficulty).should('be.visible');
        });

        it('should display coins in Circulation', () => {
          cy.get(homepage.networkSummary.coinsinCirculation).should(
            'be.visible'
          );
        });

        it('should display total Tx', () => {
          cy.get(homepage.networkSummary.totalTx).should('be.visible');
        });

        it('should display blockchain size', () => {
          cy.get(homepage.networkSummary.blockchainSize).should('be.visible');
        });

        it('should display market cap', () => {
          cy.get(homepage.networkSummary.marketCap).should('be.visible');
        });

        it('should display unconfirmed transactions', () => {
          cy.get(homepage.networkSummary.unconfirmedTx).should('be.visible');
        });

        it('should display number of btcv wallets', () => {
          cy.get(homepage.networkSummary.numberOfWallet).should('be.visible');
        });

        it('should display exchange Rate (USD)', () => {
          cy.get(homepage.networkSummary.exchangeRateUsd).should('be.visible');
        });

        it('should display chainwork', () => {
          cy.get(homepage.networkSummary.chainwork).should('be.visible');
        });

        it('should display volume', () => {
          cy.get(homepage.networkSummary.volume).should('be.visible');
        });

        it('should display exchangeRate (BTC)', () => {
          cy.get(homepage.networkSummary.exchangeRateBtc).should('be.visible');
        });
      });

      describe('Explorers tool menu', () => {
        it('should display node status & validate url', () => {
          cy.get(homepage.tools.nodeStatus)
            .should('be.visible')
            .and('have.attr', 'href', '/node-status');
        });

        it('should display peers & validate url', () => {
          cy.get(homepage.tools.Peers)
            .should('be.visible')
            .and('have.attr', 'href', '/peers');
        });

        it('should display browse blocks & validate url', () => {
          cy.get(homepage.tools.BrowseBlocks)
            .should('be.visible')
            .and('have.attr', 'href', '/blocks');
        });

        it('should display mempool summary & validate url', () => {
          cy.get(homepage.tools.mempoolSummary)
            .should('be.visible')
            .and('have.attr', 'href', '/mempool-summary');
        });

        it('should display transactions stats & validate url', () => {
          cy.get(homepage.tools.txStats)
            .should('be.visible')
            .and('have.attr', 'href', '/tx-stats');
        });

        it('should display unconfirmed transactions & validate url', () => {
          cy.get(homepage.tools.unconfirmedtransactions)
            .should('be.visible')
            .and('have.attr', 'href', '/unconfirmed-tx');
        });

        it('should display rpc browser & validate url', () => {
          cy.get(homepage.tools.rpcBrowser)
            .should('be.visible')
            .and('have.attr', 'href', '/rpc-browser');
        });

        it('should display Hashrate distribution & validate url', () => {
          cy.get(homepage.tools.hashrateDist)
            .should('be.visible')
            .and('have.attr', 'href', '/mining-pools');
        });
      });

      describe('Changing currency unit', () => {
        it('should change currency unit to mBTCV', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.header.navlist)
            .contains('mBTCV')
            .click();
          cy.get(homepage.units.units).should('contain', 'mBTCV');
        });

        it('should change currency unit to bits', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.header.navlist)
            .contains('bits')
            .click();
          cy.get(homepage.units.units).should('contain', 'bits');
        });

        it('should change currency unit to sat', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.header.navlist)
            .contains('sat')
            .click();
          cy.get(homepage.units.units).should('contain', 'sat');
        });

        it('should change currency unit to usd', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.header.navlist)
            .contains('usd')
            .click();
          cy.get(homepage.units.units).should('contain', 'usd');
        });

        it('should change currency unit to euro', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.header.navlist)
            .contains('euro')
            .click();
          cy.get(homepage.units.units).should('contain', 'euro');
        });
      });

      describe('Changing background color', () => {
        it('should start with light background', () => {
          cy.get('body').should(
            'have.css',
            'background-color',
            'rgb(52, 58, 64)'
          );
        });

        it('should change background color to dark', () => {
          cy.get(homepage.header.navBar)
            .click()
            .get(homepage.navbarTheme.dark)
            .click()
            .should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');
        });
      });

      describe('Searching data', () => {
        it('should find latest block in searchbar', () => {
          cy.get(homepage.latestBlocks.height)
            .invoke('text')
            .then(($height) => {
              const myVar = $height.replace(',', '');
              cy.get(homepage.header.searchBar).type(`${myVar}{enter}`);
              cy.get(blockheight.details.jsonTab)
                .click()
                .get(blockheight.jsonTab.blockHeight)
                .invoke('text')
                .then(($blockHeight) => {
                  expect(myVar).to.eq($blockHeight);
                });
            });
        });

        it('should find block hash in searchbar', () => {
          cy.get(homepage.latestBlocks.height).click();
          cy.get(blockheight.details.hash)
            .invoke('text')
            .then(($hash) => {
              cy.get(homepage.header.searchBar).type(`${$hash}{enter}`);
              cy.get(blockheight.details.jsonTab).click();
              cy.get(blockheight.jsonTab.hash)
                .invoke('text')
                .then(($hash1) => {
                  const myVar = $hash1.replace(/['"]+/g, '');
                  expect(myVar).to.eq($hash);
                });
            });
        });

        it('should get alert: no results for query in searchbar', () => {
          const rand = Math.random().toString(36).substring(7);
          cy.get(homepage.header.searchBar).type(`${rand}{enter}`);
          cy.get(homepage.header.noResultAlert)
            .invoke('text')
            .should('contain', `No results found for query: ${rand}`);
        });
      });
    });
  });
});
