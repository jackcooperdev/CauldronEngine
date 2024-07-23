const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const homedir = require('os').homedir()
const { cauldronLogger } = require('../tools/logger');
const { grabPath } = require('../tools/compatibility');
const { checkForValidFiles } = require('../tools/fileTools');
const { processQueue, handleDownloadQueue, handleChecksumQueue, verifyInstallation } = require('./queue');


async function getAssets(assetsIndex, assetFiles) {
    var CAULDRON_PATH = grabPath();
    return new Promise(async (resolve) => {
        if (assetsIndex != "legacy") {
            var createIndexsFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'indexes'))
            var createObjectsFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'objects'))
            var objects = assetFiles.objects;
            var dQueue = assetFiles;
            var checkForFiles = await verifyInstallation(dQueue);
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
        } else if (assetsIndex == "legacy") {
            cauldronLogger.info('Handling Legacy Assets');
            var createVirtualFolder = shell.mkdir('-p', path.join(CAULDRON_PATH, 'assets', 'virtual', 'legacy'))
            var objects = assetFiles.objects;
            var dQueue = assetFiles
            var checkForFiles = await verifyInstallation(dQueue)
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
        };
        if (assetsIndex == 'pre-1.6') {
            // Pre 1.6 (Stream To Resources)
            cauldronLogger.info('Pre 1.6 Assets');
            var createResources  = shell.mkdir('-p', path.join(CAULDRON_PATH, 'resources'))
            var dQueue = assetFiles
            var checkForFiles = await verifyInstallation(dQueue);
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
            resolve(true);
        } else {
            // Mark AssetFile As Downloaded
            var currentAssetFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH,'assets.json')));
            currentAssetFile[assetsIndex] = true;
            fs.writeFileSync(path.join(CAULDRON_PATH,'assets.json'),JSON.stringify(currentAssetFile));
            resolve(true)
        }

    })

}


module.exports = { getAssets };