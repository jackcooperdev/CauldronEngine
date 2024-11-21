const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const homedir = require('os').homedir()
const StreamZip = require('node-stream-zip');

const { grabPath, getOperatingSystem } = require('../tools/compatibility');
const { verifyInstallation } = require('./queue');
const { cauldronLogger } = require('../tools/logger');
const { checkInternet } = require('../tools/checkConnection');


async function getLibraries(libData, versionData,maniID) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            if (versionData.loader == 'vanilla') {
                version = versionData.version;
            } else if (versionData.loader == 'forge') {
                version = `forge-${versionData.version}-${versionData.loaderVersion}`;
            }
            let acutalOS = getOperatingSystem();
            let dQueue = new Array();
            let libArray = new Array();
            cauldronLogger.info(`Operating System: ${acutalOS}`);
            let nativeLock = false;
            if (fs.existsSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives'))) {
                nativeLock = true;
            }
            for (idx in libData) {
                libAllowed = true;
                if (libData[idx].rules) {
                    for (rIdx in libData[idx].rules) {
                        if (libData[idx].rules[rIdx].action == "allow") {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name != acutalOS) {
                                    libAllowed = false;
                                }
                            }
                        } else {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name == acutalOS) {
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
                    if (libData[idx].downloads.classifiers && checkInternet() && !nativeLock) {
                        let natives = libData[idx].downloads.classifiers[libData[idx].natives[acutalOS]];
                        if (!natives) {
                            if (libData[idx].natives && libData[idx].natives[acutalOS] && libData[idx].natives[acutalOS].includes("arch")) {
                                let newOS = `natives-${acutalOS}-64`
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
                            let checkForNative = await verifyInstallation([obj]);
                            let extractFile = false;
                            if (needsExtracting) {
                                const zip = new StreamZip.async({ file: path.join(obj.destination, obj.fileName) });
                                const entriesCount = await zip.entriesCount;
                                const entries = await zip.entries();
                                for (const entry of Object.values(entries)) {
                                    if (!entry.name.includes("META-INF") && !entry.name.includes(".git") && !entry.name.includes(".sha1")) {
                                        await zip.extract(entry.name, path.join(CAULDRON_PATH, 'versions', maniID, 'natives'));
                                    }
                                }
                                zip.close();
                                fs.rmSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives', obj.fileName))
                            }
                        }
                    }
                }
            }
            if (checkInternet()) {
                let checkForFiles = await verifyInstallation(dQueue,false);
            }
            cauldronLogger.info(`Checksums Passed Install is Valid!2`);
            resolve(libArray);
        } catch (err) {
            reject(err);
        }

    })
}

module.exports = { getLibraries }