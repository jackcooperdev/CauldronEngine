const Promise = require("bluebird"); // If you're using `bluebird` as a global polyfill, you might not need to assign it to a const. If you're using specific Bluebird features, keep this.
const { download, validate } = require("../tools/fileTools.js");
const { cauldronLogger } = require("../tools/logger.js");
const fs = require("fs");
const path = require("path");
const { getOperatingSystem } = require("../tools/compatibility.js");
const {pipeline} = require('stream/promises')
const unzipper = require('unzipper')
const {reject} = require("bluebird");
function removeItem(array, item) {
    let i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}

async function checkDownloadAndCheck(item) {
    return new Promise(async (resolve,reject) => {
        try {
            let validateItem = await validate(item);
            while (typeof validateItem == "object") {
                let out = await download(validateItem.origin, validateItem.destination, validateItem.fileName);
                if (!out) {
                    reject(`File Not Found: ${validateItem.origin}`);
                }
                // Extract zip and replace with extracted contents (packwiz only)

                if (validateItem.fileName.endsWith(".zip") && validateItem.forceUnzip) {
                    const zipPath = path.join(validateItem.destination, validateItem.fileName);
                    await pipeline(
                        fs.createReadStream(zipPath),
                        unzipper.Extract({ path: validateItem.destination })
                    );
                    fs.unlinkSync(zipPath); // remove zip after extraction
                }

                validateItem = await validate(item);
                const CURRENT_OPERATING_SYSTEM = getOperatingSystem();

                // Make jars (and extracted binaries) executable on linux
                if (CURRENT_OPERATING_SYSTEM === 'linux' && item.fileName.includes('.jar')) {
                    fs.chmodSync(path.join(item.destination, item.fileName), 0o755);
                }
            }
            resolve("pass");
        } catch (e) {
            cauldronLogger.error(e);
        }
    });
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve,reject) => {
        try {
            let concurrency = queue.length;
            if (isAssetDownload) {
                concurrency = queue.length / 2;
            }
            const procQueue = await Promise.map(queue, checkDownloadAndCheck, {
                concurrency: concurrency,
            });
            removeItem(procQueue, "pass");
            resolve(procQueue);
        } catch (error) {
            reject(error);
        }

    });
}


async function processQueue(queue, isAssetDownload) {
    return new Promise(async (resolve,reject) => {
        try {
            let concurrency = queue.length;
            if (isAssetDownload) {
                concurrency = queue.length / 2;
            }

            const procQueue = await Promise.map(queue, (item) => checkDownloadAndCheck(item), // Wrap your function
                {concurrency: concurrency});
            removeItem(procQueue, "pass");
            resolve(procQueue);
        } catch (e) {
            reject(e);
        }

    });
}


module.exports =  {verifyInstallation, processQueue};
