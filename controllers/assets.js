const fs = require('fs');
const path = require('path');
const { cauldronLogger } = require('../tools/logger');
const { grabPath } = require('../tools/compatibility');
const { verifyInstallation } = require('./queue');


async function getAssets(assetsIndex, assetFiles) {
    let CAULDRON_PATH = grabPath();
    return new Promise(async (resolve) => {
        let dQueue = assetFiles
        let checkForFiles = await verifyInstallation(dQueue,true);
        cauldronLogger.info(`Checksums Passed Install is Valid!`);
        if (assetsIndex != 'pre-1.6') {
            // Mark AssetFile As Downloaded
            let currentAssetFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'assets_installed.json')));
            let assetObj = {
                installed:true,
                lastChecked:new Date().getTime()
            };
            currentAssetFile[assetsIndex] = assetObj;
            fs.writeFileSync(path.join(CAULDRON_PATH, 'assets_installed.json'), JSON.stringify(currentAssetFile));
        };
        resolve(true)
    });
};


module.exports = { getAssets };