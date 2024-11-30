const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const axios = require('axios');
const osCurrent = require('os').platform();

// Import Tools
const {grabPath} = require('../tools/compatibility');
const {
    attemptToConvert,
    convertAssets,
    convertLegacyAssets,
    convertPre16Assets
} = require('../tools/manifestConverter');
const {cauldronLogger} = require('../tools/logger');
const {checkInternet} = require('../tools/checkConnection');
const NEW_LOGS = require('../files/logs-locations.json');
const {checkCompat} = require('./jvm');
const {destroySession} = require('../tools/sessionManager');
const {checkManifestPlugin, getDataPlugin, getIdentifierPlugin} = require('../plugins/plugins');


async function checkManifest(fileName, url, requiresConvert, type) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, fileName)).toString());
            if (isOnline && !requiresConvert && type === 'main') {
                // Only Update Main Manifest
                downloadManifest(url, path.join(CAULDRON_PATH, fileName)).then(function () {
                    cauldronLogger.info("Updated Local Manifest");
                })
            }
            resolve(expected);
        } catch (err) {
            cauldronLogger.warn(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), requiresConvert, type);
                    resolve(downloadedFile);
                } catch (err) {
                }

            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`)
            }
        }
    })
}

async function checkOther(fileName, url) {
    return new Promise(async (resolve, reject) => {
        let isOnline = await checkInternet();
        let CAULDRON_PATH = grabPath();
        try {
            let expected = fs.readFileSync(path.join(CAULDRON_PATH, fileName));
            resolve(expected)
        } catch (err) {
            cauldronLogger.warn(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadOther(url, path.join(CAULDRON_PATH, fileName))
                    resolve(downloadedFile);
                } catch (err) {
                    reject(err);
                }

            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`)
            }
        }
    })
}

async function downloadOther(url, dir) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: 'get',
            url: url,
            responseType: 'arraybuffer'
        };
        try {
            const file = await axios(config);
            shelljs.mkdir('-p', path.join(dir, '../'));
            fs.writeFileSync(dir, file.data);
            resolve(file.data);
        } catch (err) {
            reject(err.message)
        }
    })
}

let convertManifests = {
    'assets': convertAssets,
    'legacy': convertLegacyAssets,
    'pre-1.6': convertPre16Assets
};

async function downloadManifest(url, dir, requiresConvert, type) {
    return new Promise(async (resolve, reject) => {
        let config = {
            method: 'get',
            url: url
        };
        try {
            const file = await axios(config);
            shelljs.mkdir('-p', path.join(dir, '../'));
            let fileData = file.data;
            if (requiresConvert) {
                fileData = await convertManifests[type](fileData);
            }
            fs.writeFileSync(dir, JSON.stringify(fileData));
            resolve(fileData);
        } catch (err) {
            reject(err.message)
        }
    })
}

async function getPackwizJVM() {
    // Used to Assist Packwiz on client.
    // not used in launcher
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        // Check for jvm file
        if (!fs.existsSync(path.join(CAULDRON_PATH, 'jvm_installed.json'))) {
            fs.writeFileSync(path.join(CAULDRON_PATH, 'jvm_installed.json'), '{}');
        }
        try {

            // JVM Manifests
            // Check For Meta
            const jvmMeta = await checkManifest(path.join('jvm', 'jvm-core.json'), 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json')
            const jvmCompat = await checkCompat('java-runtime-alpha', jvmMeta);
            let jvmMani;
            if (jvmCompat) {
                jvmMani = await checkManifest(path.join('jvm', 'java-runtime-alpha.json'), jvmCompat[0].manifest.url);
            } else {
                reject('Version Not Supported on ' + osCurrent);
            }

            let allManifests = {
                jvmMeta: jvmMeta,
                jvmMani: jvmMani,
                jvmComp: 'java-runtime-alpha',
            };
            resolve(allManifests);
        } catch (err) {
            reject(err);
        }

    })
}


async function getManifests(v, l, lv) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            // Check for an asset installation file
            if (!fs.existsSync(path.join(CAULDRON_PATH, 'assets_installed.json'))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, 'assets_installed.json'), '{}');
            }

            // Check for jvm file
            if (!fs.existsSync(path.join(CAULDRON_PATH, 'jvm_installed.json'))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, 'jvm_installed.json'), '{}');
            }

            // Check for a library installations file
            if (!fs.existsSync(path.join(CAULDRON_PATH, 'libs_installed.json'))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, 'libs_installed.json'), '{}');
            }
            const assetDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'assets_installed.json')).toString());
            const jvmDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'jvm_installed.json')).toString());
            const libDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'libs_installed.json')).toString());
            // Convert to Actual Values
            let gotVersion;
            if (l !== 'vanilla') {
                gotVersion = await checkManifest(`cauldron_${l}_version_manifest.json`, await getDataPlugin(l), false, 'main');
            } else {
                gotVersion = await checkManifest('cauldron_version_manifest.json', 'https://launchermeta.mojang.com/mc/game/version_manifest.json', false, 'main');
            }
            const {version, loaderVersion, loader} = await whatIsThis(v, l, lv, gotVersion);
            let getMain = await checkManifest('cauldron_version_manifest.json', 'https://launchermeta.mojang.com/mc/game/version_manifest.json', false, 'main');
            /**
             * @param getMain
             * @param getMain.versions
             */
            const foundVersionData = getMain.versions.find(versionName => versionName.id === version);
            if (!foundVersionData) {
                reject('Version Not Found');
            }
            const getSpec = await checkManifest(path.join('versions', foundVersionData.id, foundVersionData.id + '.json'), foundVersionData.url);
            let createdManifest;
            if (loader !== 'vanilla') {
                createdManifest = await checkManifestPlugin(loader, loaderVersion, version, getSpec, gotVersion);
            } else {
                createdManifest = await attemptToConvert(getSpec);
            }
            let grabLogging;
            if (createdManifest.logging) {
                grabLogging = await checkOther(path.join('assets', 'log_configs', createdManifest.logging.client.file.id), NEW_LOGS[createdManifest.logging.client.file.id].url);
            } else {
                cauldronLogger.warn("Destroying Session: No Logger Detected. Game will still boot");
                await destroySession();
            }
            await checkOther(path.join('versions', createdManifest.id, createdManifest.id + '.jar'), createdManifest.downloads.client.url);

            // Check for Duplicates in Libs
            let libs = createdManifest.libraries;
            const ids = libs.map(o => o.name)
            createdManifest.libraries = libs.filter(({name}, index) => !ids.includes(name, index + 1));

            // JVM Manifests

            // Check For Meta
            const jvmMeta = await checkManifest(path.join('jvm', 'jvm-core.json'), 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json')
            const jvmCompat = await checkCompat(createdManifest.javaVersion.component, jvmMeta);
            let jvmMani;
            if (jvmCompat) {
                jvmMani = await checkManifest(path.join('jvm', createdManifest.javaVersion.component + '.json'), jvmCompat[0].manifest.url);
            } else {
                reject('Version Not Supported on ' + osCurrent);
            }
            // Assets
            const assetMani = await checkManifest(path.join('assets', 'indexes', createdManifest.assets + '.json'), createdManifest.assetIndex.url);
            let specCond = createdManifest.assets
            if (createdManifest.assets !== 'legacy' && createdManifest.assets !== 'pre-1.6') {
                specCond = 'assets'
            }
            const assetsConverted = await checkManifest(path.join('assets', 'indexes', createdManifest.assets + '-cauldron.json'), createdManifest.assetIndex.url, true, specCond);

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
                main: getMain,
                spec: createdManifest,
                logging: grabLogging,
                jvmMeta: jvmMeta,
                jvmMani: jvmMani,
                jvmComp: createdManifest.javaVersion.component,
                assets: assetMani,
                assetsInfo: assetsConverted,
                version: version,
                versionData: {loader: loader, version: version, loaderVersion: loaderVersion},
                loader: loader,
                assetsDownloaded: haveAssetsBeenDownloaded,
                jvmDownloaded: hasJVMBeenDownloaded,
                libsDownloaded: hasLibsBeenDownloaded,
                loaderVersion: loaderVersion
            };
            resolve(allManifests);


        } catch (err) {
            reject(err);
        }

    })
}


// What Is This? Function
// Helps convert terms like release and snapshot into actual versions
// Also grabs information for the selected loader (like loader version)

async function whatIsThis(version, loader, lVersion, MANIFEST) {
    if (!loader) {
        loader = 'vanilla';
    }
    let versionFound;
    /**
     * @param MANIFEST
     * @param MANIFEST.latest
     */
    if (version === 'release' || version === 'latest') {
        versionFound = MANIFEST.latest.release;
    } else if (version === 'snapshot') {
        versionFound = MANIFEST.latest.snapshot;
    } else {
        versionFound = version
    }
    let rObject = {version: versionFound, loaderVersion: '', loader: loader}
    try {
        if (loader !== 'vanilla') {
            if (!lVersion) {
                lVersion = await getIdentifierPlugin(loader, versionFound, MANIFEST)
            }
            rObject.loaderVersion = lVersion;
        }
    } catch (err) {
        throw new Error(err.message)
    }
    return rObject;
}


module.exports = {getManifests, getPackwizJVM}