// noinspection JSUnusedGlobalSymbols,JSUnresolvedReference

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const os = require("os");
// Import Tools
const { grabPath } = require("../tools/compatibility.js");
const {
    addOSSpecArguments,
    convertJVM,
    convertAssetsAll,
    convertLibraries,
} = require("../tools/manifestConverter.js");
const { cauldronLogger } = require("../tools/logger.js");
const { checkInternet } = require("../tools/checkConnection.js");
const { getOperatingSystem } = require("../tools/compatibility");
const JSZip = require('jszip');

// Current Manifest Identifer (Changing this will invalidate files)
const MANIFEST_IDENTIFIER = 'apple';

const osCurrent = os.platform();

const RESOURCES_PATH = process.env.RESOURCE_SERVER || "https://resources.cauldronmc.com"


async function checkManifest(fileName, url, type, noSave) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, fileName)).toString());
            if (isOnline && type === "main" || isOnline && fileName.includes("release")) {
                expected = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), undefined);
            }
            resolve(expected);
        } catch (err) {
            cauldronLogger.debug(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), type, noSave);
                    resolve(downloadedFile);
                } catch (err) {
                    reject(`This Profile either do3es not exist or is not supported`);
                }
            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`);
            }
        }
    });
}

async function checkCompat(jVersion, jvmData, forceCompat) {
    const actualPlatform = getOperatingSystem(true);
    let isCompatible = jvmData[actualPlatform]?.[jVersion] ?? false;

    if (isCompatible.length === 0 && actualPlatform === "mac-os-arm64" || actualPlatform === "mac-os-arm64" && forceCompat) {
        // Lock with yes (investgate rosseta)
        cauldronLogger.debug("Compatibility Forced (Using Rosetta)");
        isCompatible = jvmData['mac-os']?.[jVersion]
    }

    return isCompatible
}


async function downloadManifest(url, dir, type, noSave) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: "get",
            url: url,
        };
        try {
            const file = await axios(config);
            let fileData = file.data;
            if (dir.includes("release")) {
                let CAULDRON_PATH = grabPath();
        
                let version = fileData.id
                let newPath;
                if (!url.includes("post.json")) {
                    newPath = path.join(CAULDRON_PATH, 'versions', version, `${version}.json`)
                } else {
                    let splitVersion = fileData.version.split("-");
                    version = `forge-${splitVersion[0]}-${splitVersion[2]}`
                    newPath = path.join(CAULDRON_PATH, 'versions', version, `post.json`)
                }
                dir = newPath;
            }
            if (!noSave) {
                fs.mkdirSync(path.dirname(dir), { recursive: true });
                fs.writeFileSync(dir, JSON.stringify(fileData, null, 2));
            }
            resolve(fileData);
        } catch (err) {
            reject(err.message);
        }
    });
}

async function getCEObject(installObject) {
    return new Promise(async (resolve, reject) => {
        try {

            let { version: v, loader: l, lv } = installObject;
            const CAULDRON_PATH = grabPath();

            let ceObject = {
                libList: [],
                nativeList: [],
                loggingInfo: {},
                installQueue: [],
                jreVersion: '',
                specPath: '',
                vanillaVersion: v,
                loader: l,
                lv: lv,
                specName: '',
                post: false,
            }
            let installQueue = [];

            let specPath = l !== 'vanilla' ? `/loaders/${l}/${v}/${lv}` : `/spec/${v}`
            let specLocation = l !== "vanilla" ? `${l}-${v}-${lv}` : v;

            const foundManifest = await checkManifest(path.join("versions", specLocation, `${specLocation}.json`), `${RESOURCES_PATH}${specPath}`, 'spec')
            if (!foundManifest) {
                return reject({ message: `Version not ${l === "vanilla" ? "found" : `supported for loader: ${l}`}` });
            }

            if (foundManifest.id.includes("forge") || foundManifest.id.includes("fabric")) {
                v = foundManifest.id.split("-")[1]
            } else {
                v = foundManifest.id;
            }
            lv = foundManifest.loaderVersion || foundManifest.version;

            const createdManifest = await addOSSpecArguments(foundManifest);
            let potentialCE = path.join(CAULDRON_PATH, 'versions', createdManifest.id, 'version.ce')
            if (fs.existsSync(potentialCE)) {
                const data = fs.readFileSync(potentialCE)
                const zip = await JSZip.loadAsync(data);
                let contents = Object.keys(zip.files);
                let expectedFile = createVersionIdentifier(v, l, lv, CAULDRON_PATH);
                if (contents.includes(expectedFile)) {
                    const fileBuffer = await zip.files[expectedFile].async('string');
                    let ceObj = JSON.parse(fileBuffer);
                    resolve(ceObj);
                    return;
                }
            }
            ceObject.vanillaVersion = v;
            ceObject.lv = lv;


            // Append Logging
            if (createdManifest.logging) {
                const logFile = createdManifest.logging.client.file;
                const logPath = path.join("assets", "log_configs");
                createdManifest.logging.client.file.destination = path.join(CAULDRON_PATH, logPath);
                createdManifest.logging.client.file.sha1 = 'NONE';
                createdManifest.logging.client.file.fileName = logFile.id;
                createdManifest.logging.client.file.origin = createdManifest.logging.client.file.url.replace(RESOURCES_PATH, '${resourcePath}')
                installQueue.push(createdManifest.logging.client.file);
                ceObject.loggingInfo = createdManifest.logging.client.file;
            };

            // Append Entry File
            let javaEntryObject = {
                sha1: createdManifest.downloads.client.sha1,
                destination: path.join(CAULDRON_PATH, "versions", createdManifest.id),
                fileName: createdManifest.id + ".jar",
                origin: createdManifest.downloads.client.url
            }
            installQueue.push(javaEntryObject)

            // Java
            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json", "java");
            const jvmCompat = await checkCompat(createdManifest.javaVersion.component, jvmMeta, createdManifest.javaVersion.forceCompat);
            if (!jvmCompat) return reject("Version Not Supported on " + osCurrent);
            let extra = '';
            if (createdManifest.javaVersion.forceCompat && getOperatingSystem() === 'osx') {
                extra = '-compat';
            }
            const jvmMani = await checkManifest(path.join("jvm", `${createdManifest.javaVersion.component}${extra}.json`), jvmCompat[0].manifest.url, "java");
            let jvmQueue = await convertJVM(`${createdManifest.javaVersion.component}${extra}`, jvmMani);
            ceObject.jreVersion = `${createdManifest.javaVersion.component}${extra}`
            // Assets
            const assetMani = await checkManifest(path.join("assets", "indexes", `${createdManifest.assets}.json`), createdManifest.assetIndex.url, "assetIndex");
            const assetType = ["legacy", "pre-1.6"].includes(createdManifest.assets) ? createdManifest.assets : "assets";
            const assetsQueue = await convertAssetsAll(assetMani, assetType)

            // Libraries
            const ids = createdManifest.libraries.map((lib) => lib.name);
            createdManifest.libraries = createdManifest.libraries.filter(({ name }, index) => !ids.includes(name, index + 1));

            const { libQueue, libList, nativeList } = await convertLibraries(createdManifest.libraries, createdManifest.id)

            if (createdManifest.requiresPost) {
                ceObject.post = await checkManifest(path.join("versions", specLocation, "post.json"), `${RESOURCES_PATH}/loaders/${l}/${createdManifest.id.split("-")[1]}-${lv}/post.json`, "spec", true)
            }

            const finalQueue = [...installQueue, ...jvmQueue, ...assetsQueue, ...libQueue]

            ceObject.installQueue = finalQueue;
            ceObject.libList = libList
            ceObject.nativeList = nativeList;
            ceObject.specPath = path.join("versions", createdManifest.id, createdManifest.id + '.json')
            ceObject.specName = createdManifest.id;

            fs.mkdirSync(path.join(CAULDRON_PATH, 'versions', createdManifest.id), { recursive: true });
        
            const zip = new JSZip();

            zip.file(createVersionIdentifier(ceObject.vanillaVersion, ceObject.loader, ceObject.lv, CAULDRON_PATH), JSON.stringify(ceObject, null, 2));

            const buffer = await zip.generateAsync({
                type: "nodebuffer",
                compression: "DEFLATE",
                compressionOptions: { level: 6 },
            });
            fs.writeFileSync(path.join(CAULDRON_PATH, 'versions', createdManifest.id, 'version.ce'), buffer)
            resolve(ceObject)

        } catch (e) {
            reject(e)
        }
    })

}

function createVersionIdentifier(version, loader, lv, root) {
    let identifierPhrase = `${version}-${loader}-${MANIFEST_IDENTIFIER}-${lv}-${root}`;
    return btoa(identifierPhrase)
}

async function whatIsThis(version, vanillaManifest) {
    if (version === "release" || version === "latest") {
        return vanillaManifest.latest.release;
    } else if (version === "snapshot") {
        return vanillaManifest.latest.snapshot;
    } else {
        return version;
    }
}

module.exports = {  whatIsThis, getCEObject };
