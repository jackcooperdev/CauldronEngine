// noinspection JSUnusedGlobalSymbols,JSUnresolvedReference

import fs from "fs";
import path from "path";
import shelljs from "shelljs";
import axios from "axios";
import os from "os";
// Import Tools
import {grabPath} from "../tools/compatibility.js";
import {
    addOSSpecArguments,
    convertAssets,
    convertLegacyAssets,
    convertPre16Assets,
} from "../tools/manifestConverter.js";
import {cauldronLogger} from "../tools/logger.js";
import {checkInternet} from "../tools/checkConnection.js";
import {checkCompat} from "./jvm.js";


const osCurrent = os.platform();
const RESOURCES_PATH = "https://resources.cauldronmc.com"

async function checkManifest(fileName, url, type) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, fileName)).toString(),);
            if (isOnline && type === "main") {
                // Only Update Main Manifest
                await downloadManifest(url, path.join(CAULDRON_PATH, fileName))
            }
            resolve(expected);
        } catch (err) {
            cauldronLogger.debug(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), type);
                    resolve(downloadedFile);
                } catch (err) {
                    console.log(err);
                }
            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`,);
            }
        }
    });
}

async function checkJAR(fileName, url) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = fs.readFileSync(path.join(CAULDRON_PATH, fileName));
            resolve(expected);
        } catch (err) {
            if (isOnline) {
                try {
                    const downloadedFile = await downloadALL(url, path.join(CAULDRON_PATH, fileName));
                    resolve(downloadedFile);
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`);
            }
        }
    });
}

async function downloadALL(url, dir) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: "get", url: url, responseType: "arraybuffer",
        };
        try {
            const file = await axios(config);
            shelljs.mkdir("-p", path.join(dir, "../"));
            fs.writeFileSync(dir, file.data);
            resolve(file.data);
        } catch (err) {
            reject(err.message);
        }
    });
}

async function checkLog(fileName, url) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        if (isOnline) {
            try {
                const downloadedFile = await downloadALL(url, path.join(CAULDRON_PATH, fileName));
                resolve(downloadedFile);
            } catch (err) {
                reject(err);
            }
        }
    });
}

let convertManifests = {
    assets: convertAssets, legacy: convertLegacyAssets, "pre-1.6": convertPre16Assets,
};

async function downloadManifest(url, dir, type) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: "get", url: url,
        };
        try {
            const file = await axios(config);
            shelljs.mkdir("-p", path.join(dir, "../"));
            let fileData = file.data;
            if (convertManifests[type]) {
                fileData = await convertManifests[type](fileData);
            }
            fs.writeFileSync(dir, JSON.stringify(fileData, null, 2));
            resolve(fileData);
        } catch (err) {
            reject(err.message);
        }
    });
}

async function getPackwizJVM() {
    // Used to Assist Packwiz on a client.
    // Not used in launcher
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        // Check for jvm file
        if (!fs.existsSync(path.join(CAULDRON_PATH, "config","jvm_installed.json"))) {
            fs.writeFileSync(path.join(CAULDRON_PATH, "config","jvm_installed.json"), "{}");
        }
        try {
            // JVM Manifests
            // Check For Meta
            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json",);
            const jvmCompat = await checkCompat("java-runtime-alpha", jvmMeta);
            let jvmMani;
            if (jvmCompat) {
                jvmMani = await checkManifest(path.join("jvm", "java-runtime-alpha.json"), jvmCompat[0].manifest.url,);
            } else {
                reject("Version Not Supported on " + osCurrent);
            }

            let allManifests = {
                jvmMeta: jvmMeta, jvmMani: jvmMani, jvmComp: "java-runtime-alpha",
            };
            resolve(allManifests);
        } catch (err) {
            reject(err);
        }
    });
}

async function getManifests(v, l, lv) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            if (!fs.existsSync(path.join(CAULDRON_PATH, "config"))) {
                fs.mkdirSync(path.join(CAULDRON_PATH, "config"))
            }
            // Check / Create Persistence Files
            // Check for an asset installation file

            if (!fs.existsSync(path.join(CAULDRON_PATH, "config/assets_installed.json"))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json"), "{}",);
            }

            // Check for jvm file
            if (!fs.existsSync(path.join(CAULDRON_PATH, "config/jvm_installed.json"))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json"), "{}");
            }

            // Check for a library installations file
            if (!fs.existsSync(path.join(CAULDRON_PATH, "config/libs_installed.json"))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, "config/libs_installed.json"), "{}");
            }
            const assetDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json")).toString(),);
            const jvmDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json")).toString(),);
            const libDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/libs_installed.json")).toString(),);

            // Convert to Actual Values
            let manifest;
            let vanillaManifest;

            if (l !== "vanilla") {
                manifest = await checkManifest(`cauldron_${l}_version_manifest.json`, `${RESOURCES_PATH}/loaders/${l}/version_manifest.json`, "main");
                vanillaManifest = await checkManifest("cauldron_version_manifest.json", `${RESOURCES_PATH}/version_manifest.json`, "main",);

            } else {
                manifest = await checkManifest("cauldron_version_manifest.json", `${RESOURCES_PATH}/version_manifest.json`, "main",);
                vanillaManifest = manifest;
            }

            const version = await whatIsThis(v, vanillaManifest);
            v = version;
            /**
             * @param vanillaManifest
             * @param vanillaManifest.versions
             */
            const foundVersionData = manifest.versions.find((versionName) => versionName.id === version);
            if (!foundVersionData) {
                if (l === "vanilla") {
                    reject({"message": "Version not found"});
                } else {
                    reject({"message": "Version not supported for loader: " + l});
                }

                return;
            }

            // Set Loader Version
            lv = foundVersionData.loaderVersion;

            // If loaderVersion is not found check in manifest

            if (!lv) {
                lv = manifest.version;
            }


            let specLocation = foundVersionData.id;

            if (l !== "vanilla") {
                specLocation = `${l}-${v}-${lv}`
            }

            const getSpec = await checkManifest(path.join("versions", specLocation, specLocation + ".json",), foundVersionData.url, "spec");
            let createdManifest = await addOSSpecArguments(getSpec);

            if (createdManifest.logging) {
                let logLocation = createdManifest.logging.client.file.url;
                if (!fs.existsSync(path.join(CAULDRON_PATH, "assets", "log_configs", createdManifest.logging.client.file.id))) {
                    await checkLog(path.join("assets", "log_configs", createdManifest.logging.client.file.id), logLocation);
                }
            }

            await checkJAR(path.join("versions", createdManifest.id, createdManifest.id + ".jar"), createdManifest.downloads.client.url);
            // Check for Duplicates in Libs
            let libs = createdManifest.libraries;
            const ids = libs.map((o) => o.name);
            createdManifest.libraries = libs.filter(({name}, index) => !ids.includes(name, index + 1));

            //JVM Manifests
            // Check For Meta
            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json", "java");
            const jvmCompat = await checkCompat(createdManifest.javaVersion.component, jvmMeta);
            let jvmMani;
            if (jvmCompat) {
                jvmMani = await checkManifest(path.join("jvm", createdManifest.javaVersion.component + ".json"), jvmCompat[0].manifest.url, "java");
            } else {
                reject("Version Not Supported on " + osCurrent);
            }
            //Assets
            const assetMani = await checkManifest(path.join("assets", "indexes", createdManifest.assets + ".json"), createdManifest.assetIndex.url, "assetIndex");
            let specCond = createdManifest.assets;
            if (createdManifest.assets !== "legacy" && createdManifest.assets !== "pre-1.6") {
                specCond = "assets";
            }
            const assetsConverted = await checkManifest(path.join("assets", "indexes", createdManifest.assets + "-cauldron.json"), createdManifest.assetIndex.url, specCond);

            // Check For Post Data Requirement

            let postData;

            if (createdManifest.requiresPost === true) {
                let expectedPostLocation = `${RESOURCES_PATH}/loaders/${l}/${v}-${lv}/post.json`
                postData = await checkManifest(path.join("versions", specLocation, "post.json",), expectedPostLocation, "spec");
            }
            // TODO: Add verification expiration (Session Based???)
            let haveAssetsBeenDownloaded = false;
            if (assetDict[createdManifest.assets]) {
                haveAssetsBeenDownloaded = true;
            }
            let hasJVMBeenDownloaded = false;
            if (jvmDict[createdManifest.javaVersion.component]) {
                hasJVMBeenDownloaded = true;
            }

            let hasLibsBeenDownloaded = false;
            if (libDict[createdManifest.id]) {
                hasLibsBeenDownloaded = true;
            }


            let allManifests = {
                spec: createdManifest,
                jvmMani: jvmMani,
                jvmComp: createdManifest.javaVersion.component,
                assets: assetMani,
                assetsInfo: assetsConverted,
                version: version,
                versionData: {
                    loader: l, version: version, loaderVersion: lv,
                },
                loader: l,
                assetsDownloaded: haveAssetsBeenDownloaded,
                jvmDownloaded: hasJVMBeenDownloaded,
                libsDownloaded: hasLibsBeenDownloaded,
                loaderVersion: lv,
                needsPost: createdManifest.requiresPost,
                postData: postData
            };

            resolve(allManifests);
        } catch (err) {
            console.error(err);
            process.exit(0)
            reject(err);
        }
    });
}

// What Is This? Function
// Helps convert terms like release and snapshot into actual versions
// Also grabs information for the selected loader (like a loader version)

async function whatIsThis(version, vanillaManifest) {
    let versionFound;
    /**
     * @param MANIFEST
     * @param MANIFEST.latest
     */
    if (version === "release" || version === "latest") {
        versionFound = vanillaManifest.latest.release;
    } else if (version === "snapshot") {
        versionFound = vanillaManifest.latest.snapshot;
    } else {
        versionFound = version;
    }
    return versionFound;
}

export {getManifests, getPackwizJVM, checkManifest, whatIsThis};
