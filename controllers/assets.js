const fs = require('fs');
const path = require('path');
const { cauldronLogger } = require('../tools/logger');
const { grabPath } = require('../tools/compatibility');
const { verifyInstallation } = require('./queue');


async function getAssets(assetsIndex, assetFiles) {
    let CAULDRON_PATH = grabPath();
    return new Promise(async (resolve) => {
        await verifyInstallation(assetFiles,true);
        cauldronLogger.info(`Checksums Passed Install is Valid!`);
        if (assetsIndex !== 'pre-1.6') {
            // Mark AssetFile As Downloaded
            let currentAssetFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'assets_installed.json')).toString());
            currentAssetFile[assetsIndex] = {
                installed: true,
                lastChecked: new Date().getTime()
            };
            fs.writeFileSync(path.join(CAULDRON_PATH, 'assets_installed.json'), JSON.stringify(currentAssetFile));
        }
        resolve(true);
    });
}


module.exports = { getAssets };