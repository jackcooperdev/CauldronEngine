const { grabPath, getOperatingSystem } = require("./compatibility.js");
const path = require("path");
const os = require("os");
const { cauldronLogger } = require("./logger.js");

const osCurrent = os.platform();

async function addOSSpecArguments(original) {
    if (osCurrent === "win32") {
        original.arguments.jvm.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",);
        original.arguments.jvm.push("-Dos.version=10.0");
    } else if (osCurrent === "darwin") {
        // Unsure if needed on newer Mac versions. require hardware to test
        // Disabling for now
        //arguments.push("-XstartOnFirstThread")
    }
    return original;
}


async function convertReleaseVersions(loader, fileData) {
    let loaderVersion, version;
    switch (loader) {
        case 'vanilla':
            version = fileData.id;
            break;
        case 'forge':

        default:
            break;
    }

    return { version, loaderVersion };

}


async function convertAssetsAll(original, type) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        let objs = original.objects;
        let objsKeys = Object.keys(objs);
        let newData = [];

        for (let obj of objsKeys) {
            let item = objs[obj];
            let fileName;
            let destination;
            let temp;
            switch (type) {
                case 'assets':
                    // Generic
                    fileName = item.hash;
                    destination = path.join(CAULDRON_PATH, "assets", "objects", item.hash.substring(0, 2),);
                    break;
                case 'legacy':
                    // Legacy
                    temp = obj.split("/");
                    fileName = temp.pop();
                    destination = path.join(CAULDRON_PATH, "assets", "virtual", "legacy", temp.join("/"),)
                    break;
                case 'pre-1.6':
                    temp = obj.split("/");
                    fileName = temp.pop();
                    destination = path.join(CAULDRON_PATH, "resources", temp.join("/"))
                    break;
                default:
                    return reject('Invalid Asset Format');
            };
            let queueItem = {
                origin: `https://resources.download.minecraft.net/${item.hash.substring(0, 2)}/${item.hash}`,
                sha1: item.hash,
                destination,
                fileName,
            };
            newData.push(queueItem);
        }
        resolve(newData);
    });
}

async function convertLibraries(libList) {
    return new Promise(async (resolve, reject) => {
        try {
            const CAULDRON_PATH = grabPath();
            let returnQueue = [];


            let actualOS = getOperatingSystem();
            let libArray = [];
            let nativeArray = [];
            cauldronLogger.debug(`OS: ${actualOS}`);

            for (let lib of libList) {
                let libAllowed = false;

                if (lib.rules) {
                    for (let rule of lib.rules) {
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
                } else {
                    libAllowed = true;
                }

                if (lib.downloads.artifact?.url === "" && !lib.downloads.artifact?.path.includes("client.jar")) {
                    libAllowed = false;
                }


                if (libAllowed) {
                    if (lib.downloads.artifact) {
                        let libPath = path.join(CAULDRON_PATH, "libraries", path.dirname(lib.downloads.artifact.path));
                        let obj = {
                            origin: lib.downloads.artifact.url,
                            sha1: lib.downloads.artifact.sha1,
                            destination: libPath,
                            isNative: false,
                            fileName: path.basename(lib.downloads.artifact.path),
                        };
                        returnQueue.push(obj)
                        if (!libPath.includes("versions")) {
                            libArray.push(path.join(obj.destination, obj.fileName));
                        }
                    };
                };

                if (lib.downloads.classifiers) {
                    let natives = lib.downloads.classifiers[lib.natives?.[actualOS]];
                    if (!natives && lib.natives?.[actualOS]?.includes("arch")) {
                        let newOS = `natives-${actualOS}-64`;
                        natives = lib.downloads.classifiers[newOS];
                    }


                    if (natives) {
                        let libPath = path.join(CAULDRON_PATH, "libraries", path.dirname(natives.path));
                        let obj = {
                            origin: natives.url,
                            sha1: natives.sha1,
                            destination: libPath,
                            isNative: true,
                            fileName: path.basename(natives.path),
                        };
                        returnQueue.push(obj)
                        nativeArray.push(path.join(obj.destination,obj.fileName))
                    }
                }
            }
            resolve({ libQueue: returnQueue, libList: libArray, nativeList: nativeArray })
        } catch (e) {
            reject(e)
        }
    })
}

async function convertJVM(name, jvmMani) {
    return new Promise(async (resolve, reject) => {
        try {
            const CAULDRON_PATH = grabPath();
            let returnQueue = [];

            const files = jvmMani.files;
            const fileKeys = Object.keys(files);

            for (let file of fileKeys) {
                let temp = files[file];

                if (temp.type === 'file') {
                    const downloadPath = path.join(CAULDRON_PATH, "jvm", name, file);
                    const downUrl = temp.downloads.raw.url;

                    returnQueue.push({
                        origin: downUrl,
                        destination: path.dirname(downloadPath),
                        sha1: temp.downloads.raw.sha1,
                        isExecutable: temp.executable,
                        fileName: path.basename(file),
                    });
                }

            }
            resolve(returnQueue)
        } catch (e) {
            reject(e)
        }
    })
}



module.exports = {
    addOSSpecArguments, convertLibraries, convertAssetsAll, convertReleaseVersions, convertJVM
};
