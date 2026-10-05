const Promise = require("bluebird");
const { download, validate } = require("../tools/fileTools.js");
const { cauldronLogger } = require("../tools/logger.js");
const fs = require("fs");
const path = require("path");
const { getOperatingSystem } = require("../tools/compatibility.js");
const JSZip = require("jszip");

function removeItem(array, item) {
    let i = array.length;

    while (i--) {
        if (array[i] === item) {
            array.splice(i, 1);
        }
    }
}

async function extractZip(zipPath, destination) {
    const data = await fs.promises.readFile(zipPath);
    const zip = await JSZip.loadAsync(data);
    const root = path.resolve(destination);

    for (const entry of Object.values(zip.files)) {
        const targetPath = path.resolve(root, entry.name);

        // Prevent path traversal
        if (targetPath !== root && !targetPath.startsWith(root + path.sep)) {
            throw new Error(`Unsafe zip entry path: ${entry.name}`);
        }

        if (entry.dir) {
            await fs.promises.mkdir(targetPath, { recursive: true });
            continue;
        }

        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        const content = await entry.async("nodebuffer");
        await fs.promises.writeFile(targetPath, content, {
            // Preserve unix permissions if the zip stored them
            mode: entry.unixPermissions || undefined,
        });
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

                // Extract zip and replace with extracted contents (packwiz only)
                if (validateItem.fileName.endsWith(".zip") && validateItem.forceUnzip) {
                    const zipPath = path.join(validateItem.destination, validateItem.fileName);
                    await extractZip(zipPath, validateItem.destination);
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
            reject(e);
        }
    });
}

async function verifyInstallation(queue, isAssetDownload) {
    return new Promise(async (resolve, reject) => {
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
    return new Promise(async (resolve, reject) => {
        try {
            let concurrency = queue.length;
            if (isAssetDownload) {
                concurrency = queue.length / 2;
            }

            const procQueue = await Promise.map(queue, (item) => checkDownloadAndCheck(item), {
                concurrency: concurrency,
            });
            removeItem(procQueue, "pass");
            resolve(procQueue);
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = { verifyInstallation, processQueue };