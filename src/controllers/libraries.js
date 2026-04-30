const fs = require("fs");
const path = require("path");
const StreamZip = require("node-stream-zip");
const { grabPath, getOperatingSystem } = require("../tools/compatibility.js");
const { processQueue, verifyInstallation } = require("./queue.js");
const { cauldronLogger } = require("../tools/logger.js");
const { checkInternet } = require("../tools/checkConnection.js");

async function getLibraries(libList, versionData, maniID, customName) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            let currentLibraryFile = JSON.parse(
                fs.readFileSync(path.join(CAULDRON_PATH, "config/libs_installed.json")).toString()
            );
            let actualOS = getOperatingSystem();
            let dQueue = [];
            let libArray = [];
            cauldronLogger.debug(`Operating System: ${actualOS}`);

            let nativeLock = false;
            if (fs.existsSync(path.join(CAULDRON_PATH, "versions", maniID, "natives"))) {
                nativeLock = true;
            }

            for (let idx in libList) {
                let libAllowed = true;

                if (libList[idx].rules) {
                    for (let rIdx in libList[idx].rules) {
                        const rule = libList[idx].rules[rIdx];
                        if (!rule.os || !rule.os.name) {
                            if (rule.action === "allow") {
                                libAllowed = true;
                                break;
                            } else {
                                libAllowed = false;
                                break;
                            }
                        } else { // The rule has an OS specified
                            if (rule.action === "allow") {
                                if (rule.os.name === actualOS) {
                                    libAllowed = true;
                                }
                            } else { // action is "disallow"
                                if (rule.os.name === actualOS) {
                                    libAllowed = false;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (libList[idx].downloads.artifact?.url === "") {
                    libAllowed = false;
                }

                if (libAllowed) {
                    if (libList[idx].downloads.artifact) {
                        const libPath = path.join(
                            CAULDRON_PATH,
                            "libraries",
                            path.dirname(libList[idx].downloads.artifact.path)
                        );
                        fs.mkdirSync(libPath, { recursive: true });

                        let obj = {
                            origin: libList[idx].downloads.artifact.url,
                            sha1: libList[idx].downloads.artifact.sha1,
                            destination: libPath,
                            fileName: path.basename(libList[idx].downloads.artifact.path),
                        };
                        dQueue.push(obj);
                        if (!obj.destination.includes("versions")) {
                            libArray.push(path.join(obj.destination, obj.fileName));
                        }
                    }

                    if (libList[idx].downloads.classifiers && (await checkInternet()) && !nativeLock) {
                        let natives = libList[idx].downloads.classifiers[libList[idx].natives?.[actualOS]];
                        if (!natives && libList[idx].natives?.[actualOS]?.includes("arch")) {
                            let newOS = `natives-${actualOS}-64`;
                            natives = libList[idx].downloads.classifiers[newOS];
                        }
                        if (natives) {
                            let obj = {
                                origin: natives.url,
                                sha1: natives.sha1,
                                destination: path.join(CAULDRON_PATH, "versions", maniID, "natives"),
                                fileName: path.basename(natives.path),
                            };
                            if (!currentLibraryFile[maniID]) {
                                await verifyInstallation([obj]);
                            }
                            const zip = new StreamZip.async({
                                file: path.join(obj.destination, obj.fileName),
                            });
                            const entries = await zip.entries();
                            for (const entry of Object.values(entries)) {
                                if (
                                    !entry.name.includes("META-INF") &&
                                    !entry.name.includes(".git") &&
                                    !entry.name.includes(".sha1")
                                ) {
                                    await zip.extract(entry.name, path.join(CAULDRON_PATH, "versions", maniID, "natives"));
                                }
                            }
                            await zip.close();
                            fs.rmSync(path.join(CAULDRON_PATH, "versions", maniID, "natives", obj.fileName));
                        }
                    }
                }
            }

            let checkName = customName || maniID;
            if ((await checkInternet()) && !currentLibraryFile[checkName]) {
                await processQueue(dQueue, false, "libraries");
                currentLibraryFile[checkName] = {
                    installed: true,
                    lastChecked: new Date().getTime(),
                };
                cauldronLogger.debug(`Libraries Downloaded: ${checkName}`);
                fs.writeFileSync(
                    path.join(CAULDRON_PATH, "config/libs_installed.json"),
                    JSON.stringify(currentLibraryFile)
                );
                resolve(libArray);
            } else {
                cauldronLogger.debug(`Libraries Restored: ${checkName}`);
                resolve(libArray);
            }
        } catch (err) {
            reject(err);
        }
    });
}

module.exports =  { getLibraries };
