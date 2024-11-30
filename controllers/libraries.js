const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const StreamZip = require('node-stream-zip');

const {grabPath, getOperatingSystem} = require('../tools/compatibility');
const {verifyInstallation} = require('./queue');
const {cauldronLogger} = require('../tools/logger');
const {checkInternet} = require('../tools/checkConnection');


async function getLibraries(libData, versionData, maniID) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            let currentLibraryFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'libs_installed.json')).toString());
            let actualOS = getOperatingSystem();
            let dQueue = [];
            let libArray = [];
            cauldronLogger.info(`Operating System: ${actualOS}`);
            let nativeLock = false;
            if (fs.existsSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives'))) {
                nativeLock = true;
            }
            for (let idx in libData) {
                let libAllowed = true;
                if (libData[idx].rules) {
                    for (let rIdx in libData[idx].rules) {
                        if (libData[idx].rules[rIdx].action === "allow") {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name !== actualOS) {
                                    libAllowed = false;
                                }
                            }
                        } else {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name === actualOS) {
                                    libAllowed = false;
                                }
                            }
                        }
                    }
                }
                if (libAllowed) {
                    if (libData[idx].downloads.artifact) {
                        shell.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', libData[idx].downloads.artifact.path, '../'))
                        let obj = {
                            origin: libData[idx].downloads.artifact.url,
                            sha1: libData[idx].downloads.artifact.sha1,
                            destination: path.join(CAULDRON_PATH, 'libraries', libData[idx].downloads.artifact.path, '../'),
                            fileName: libData[idx].downloads.artifact.path.split("/")[libData[idx].downloads.artifact.path.split("/").length - 1]
                        };
                        dQueue.push(obj);
                        libArray.push(path.join(obj.destination, obj.fileName));
                    }
                    if (libData[idx].downloads.classifiers && await checkInternet() && !nativeLock) {
                        let natives = libData[idx].downloads.classifiers[libData[idx].natives[actualOS]];
                        if (!natives) {
                            if (libData[idx].natives && libData[idx].natives[actualOS] && libData[idx].natives[actualOS].includes("arch")) {
                                let newOS = `natives-${actualOS}-64`
                                natives = libData[idx].downloads.classifiers[newOS];
                            }
                        }
                        if (natives) {
                            let needsExtracting = libData[idx].extract;
                            // Force On MAC Only
                            needsExtracting = true;
                            let obj = {
                                origin: natives.url,
                                sha1: natives.sha1,
                                destination: path.join(CAULDRON_PATH, 'versions', maniID, 'natives'),
                                fileName: natives.path.split("/")[natives.path.split("/").length - 1]
                            };
                            if (!currentLibraryFile[maniID]) {
                                await verifyInstallation([obj]);
                            }
                            if (needsExtracting) {
                                const zip = new StreamZip.async({file: path.join(obj.destination, obj.fileName)});
                                const entries = await zip.entries();
                                for (const entry of Object.values(entries)) {
                                    if (!entry.name.includes("META-INF") && !entry.name.includes(".git") && !entry.name.includes(".sha1")) {
                                        await zip.extract(entry.name, path.join(CAULDRON_PATH, 'versions', maniID, 'natives'));
                                    }
                                }
                                await zip.close();
                                fs.rmSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives', obj.fileName))
                            }
                        }
                    }
                }
            }
            if (await checkInternet() && !currentLibraryFile[maniID]) {
                await verifyInstallation(dQueue, false);
            }

            currentLibraryFile[maniID] = {
                installed: true,
                lastChecked: new Date().getTime()
            };
            fs.writeFileSync(path.join(CAULDRON_PATH, 'libs_installed.json'), JSON.stringify(currentLibraryFile));
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
            resolve(libArray);
        } catch (err) {
            reject(err);
        }

    })
}

module.exports = {getLibraries}