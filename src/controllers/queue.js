const Promise = require("bluebird"); // If you're using `bluebird` as a global polyfill, you might not need to assign it to a const. If you're using specific Bluebird features, keep this.
const { download, validate } = require("../tools/fileTools.js");
const { cauldronLogger } = require("../tools/logger.js");
const fs = require("fs");
const path = require("path");
const { getOperatingSystem } = require("../tools/compatibility.js");

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
            while (typeof validateItem == "object") {
                await download(validateItem.origin, validateItem.destination, validateItem.fileName);
                validateItem = await validate(item);
                let CURRENT_OPERATING_SYSTEM = getOperatingSystem()
                // Make jars executable
                if (CURRENT_OPERATING_SYSTEM === 'linux' && item.fileName.includes('.jar')) {
                    await fs.chmodSync(path.join(item.destination,item.fileName), 0o755);
                }

            }
            resolve("pass");
        } catch (e) {
            cauldronLogger.error(e);
        }
    });
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve) => {
        let concurrency = queue.length;
        if (isAssetDownload) {
            concurrency = queue.length / 2;
        }
        const procQueue = await Promise.map(queue, checkDownloadAndCheck, {
            concurrency: concurrency,
        });
        removeItem(procQueue, "pass");
        resolve(procQueue);
    });
}


async function processQueue(queue, isAssetDownload, friendly) {
    return new Promise(async (resolve) => {
        let concurrency = queue.length;
        if (isAssetDownload) {
            concurrency = queue.length / 2;
        }

        const procQueue = await Promise.map(queue, (item) => checkDownloadAndCheck(item, friendly), // Wrap your function
            {concurrency: concurrency});
        removeItem(procQueue, "pass");
        resolve(procQueue);
    });
}


module.exports =  {verifyInstallation, processQueue};
