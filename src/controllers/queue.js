const Promise = require("bluebird");
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
    return new Promise(async (resolve, reject) => {
        try {
            let validateItem = await validate(item);


            while (typeof validateItem == "object") {
                let out = await download(validateItem.origin, validateItem.destination, validateItem.fileName);
                if (!out) {
                    return reject(`File Not Found: ${validateItem.origin}`);
                }


                validateItem = await validate(item);
                const CURRENT_OPERATING_SYSTEM = getOperatingSystem();

                // Make jars (and extracted binaries) executable on linux and macos
                if (CURRENT_OPERATING_SYSTEM !== 'windows' && (item.fileName.includes('.jar') || item.isExecutable)) {
                    fs.chmodSync(path.join(item.destination, item.fileName), 0o755);
                }

                
            }
            resolve("pass");
        } catch (e) {
            reject(e);
        }
    });
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve, reject) => {
        try {
            let concurrency = queue.length / 2;
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


module.exports = { verifyInstallation };