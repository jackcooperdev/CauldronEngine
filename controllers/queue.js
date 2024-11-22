
const Promise = require('bluebird');
const { download, validate } = require("../tools/fileTools");
const { cauldronLogger } = require("../tools/logger");



function removeItem(array, item) {
    let i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}






async function checkDownloadAndCheck(item) {
    return new Promise(async (resolve) => {
        try {
            let validateItem = await validate(item);
        while (typeof validateItem == 'object') {
            await download(validateItem.origin,validateItem.destination,validateItem.fileName);
            validateItem = await validate(item)
        }
        resolve('pass')
        } catch (e) {
            cauldronLogger.error(e);
        }
        
    })
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve) => {
        let concurrency = queue.length;
        if (isAssetDownload) {
            concurrency = queue.length / 2;
        }
        const procQueue = await Promise.map(queue, checkDownloadAndCheck, { concurrency: concurrency})
        removeItem(procQueue, 'pass');
        resolve(procQueue)
    })
}

module.exports = { verifyInstallation }
