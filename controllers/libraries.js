const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const StreamZip = require('node-stream-zip');

const {grabPath, getOperatingSystem} = require('../tools/compatibility');
const {verifyInstallation} = require('./queue');
const {cauldronLogger} = require('../tools/logger');
const {checkInternet} = require('../tools/checkConnection');


async function getLibraries(libList, versionData, maniID) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            let currentLibraryFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'libs_installed.json')).toString());
            let actualOS = getOperatingSystem();
            // Download Queue
            let dQueue = [];
            // List of Library Paths (Used for Launch)
            let libArray = [];
            cauldronLogger.info(`Operating System: ${actualOS}`);

            // Check if Natives Need to be installed.
            let nativeLock = false;
            if (fs.existsSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives'))) {
                nativeLock = true;
            }

            // Loop through libraries.
            for (let idx in libList) {
                let libAllowed = true;
                // Determine If the Client Needs / is allowed to use the library (Default to true)
                if (libList[idx].rules) {
                    for (let rIdx in libList[idx].rules) {
                        if (libList[idx].rules[rIdx].action === "allow") {
                            if (libList[idx].rules[rIdx].os) {
                                if (libList[idx].rules[rIdx].os.name !== actualOS) {
                                    libAllowed = false;
                                }
                            }
                        } else {
                            if (libList[idx].rules[rIdx].os) {
                                if (libList[idx].rules[rIdx].os.name === actualOS) {
                                    libAllowed = false;
                                }
                            }
                        }
                    }
                }

                // Only Continue if Needed
                if (libAllowed) {
                    // Check for Download Artifact and convert and push to download queue and add to a library array.
                    if (libList[idx].downloads.artifact) {
                        shell.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', libList[idx].downloads.artifact.path, '../'))
                        let obj = {
                            origin: libList[idx].downloads.artifact.url,
                            sha1: libList[idx].downloads.artifact.sha1,
                            destination: path.join(CAULDRON_PATH, 'libraries', libList[idx].downloads.artifact.path, '../'),
                            fileName: libList[idx].downloads.artifact.path.split("/")[libList[idx].downloads.artifact.path.split("/").length - 1]
                        };
                        dQueue.push(obj);
                        libArray.push(path.join(obj.destination, obj.fileName));
                    }


                    if (libList[idx].downloads.classifiers && await checkInternet() && !nativeLock) {
                        let natives = libList[idx].downloads.classifiers[libList[idx].natives[actualOS]];
                        if (!natives) {
                            if (libList[idx].natives && libList[idx].natives[actualOS] && libList[idx].natives[actualOS].includes("arch")) {
                                let newOS = `natives-${actualOS}-64`
                                natives = libList[idx].downloads.classifiers[newOS];
                            }
                        }
                        if (natives) {
                            let obj = {
                                origin: natives.url,
                                sha1: natives.sha1,
                                destination: path.join(CAULDRON_PATH, 'versions', maniID, 'natives'),
                                fileName: natives.path.split("/")[natives.path.split("/").length - 1]
                            };
                            if (!currentLibraryFile[maniID]) {
                                await verifyInstallation([obj]);
                            }
                                const zip = new StreamZip.async({file: path.join(obj.destination, obj.fileName)});
                                const entries = await zip.entries();
                                for (const entry of Object.values(entries)) {
                                    if (!entry.name.includes("META-INF") && !entry.name.includes(".git") && !entry.name.includes(".sha1")) {
                                        await zip.extract(entry.name, path.join(CAULDRON_PATH, 'versions', maniID, 'natives'));
                                    }
                                }
                                await zip.close();
                                fs.rmSync(path.join(CAULDRON_PATH, 'versions', maniID, 'natives', obj.fileName));
                        }
                    }
                }
            }
            if (await checkInternet() && !currentLibraryFile[maniID]) {
                await verifyInstallation(dQueue, false);
                currentLibraryFile[maniID] = {
                    installed: true,
                    lastChecked: new Date().getTime()
                };
                cauldronLogger.info(`Libraries Downloaded`);
                fs.writeFileSync(path.join(CAULDRON_PATH, 'libs_installed.json'), JSON.stringify(currentLibraryFile));
                resolve(libArray);
            } else {
                cauldronLogger.info(`Libraries Restored`);
                resolve(libArray);
            }

        } catch (err) {
            reject(err);
        }

    })
}

module.exports = {getLibraries}