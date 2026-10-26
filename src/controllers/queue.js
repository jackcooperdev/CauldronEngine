const Promise = require("bluebird");
const { download, validate } = require("../tools/fileTools.js");
const { cauldronLogger } = require("../tools/logger.js");
const fs = require("fs");
const path = require("path");
const { getOperatingSystem, grabPath } = require("../tools/compatibility.js");
const { createProgressBar } = require("../tools/progressBar.js");

function removeItem(array, item) {
    let i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}


const GROUPS = ["Client", "Libraries", "Java", "Assets", "Other"];

function getGroup(item, root) {
    const destination = item.destination || "";
    if (!destination.startsWith(root)) {
        return "Other";
    }
    switch (destination.slice(root.length).split(path.sep)[0]) {
        case "versions":
            return "Client";
        case "libraries":
            return "Libraries";
        case "jvm":
            return "Java";
        case "assets":
        case "resources":
            return "Assets";
        default:
            return "Other";
    }
}

async function checkDownloadAndCheck(item, onDownload) {
    return new Promise(async (resolve, reject) => {
        try {
            let validateItem = await validate(item);


            while (typeof validateItem == "object") {
                if (onDownload) {
                    onDownload();
                }
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

async function verifyInstallation(queue, isAssetDownload, label = "Downloading Files") {
    return new Promise(async (resolve, reject) => {
        const root = path.resolve(grabPath()) + path.sep;
        const itemGroups = queue.map(item => getGroup(item, root));
        const progress = createProgressBar(label, GROUPS.map(name => ({
            name,
            total: itemGroups.filter(group => group === name).length,
        })));
        try {
            let concurrency = queue.length / 2;
            if (isAssetDownload) {
                concurrency = queue.length / 2;
            }
            const procQueue = await Promise.map(queue, async (item, index) => {
                let downloaded = false;
                const result = await checkDownloadAndCheck(item, () => downloaded = true);
                progress.tick(itemGroups[index], downloaded);
                return result;
            }, {
                concurrency: concurrency,
            });
            progress.stop();
            removeItem(procQueue, "pass");
            resolve(procQueue);
        } catch (error) {
            progress.stop(false);
            reject(error);
        }
    });
}


module.exports = { verifyInstallation };