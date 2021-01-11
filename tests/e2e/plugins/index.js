const fs = require('fs-extra');
const path = require('path');

function getConfigurationByFile(file) {
  const pathToConfigFile = path.resolve(
    '..',
    'EXPLORER',
    'tests',
    'e2e',
    'config',
    `${file}.json`
  );
  return fs.readJson(pathToConfigFile);
}
module.exports = (on, config) => {
  const file = config.env.configFile || 'local';
  return getConfigurationByFile(file);
};
