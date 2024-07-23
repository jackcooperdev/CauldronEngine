const fs = require('fs');
const homedir = require('os').homedir();
const path = require('path');
const shelljs = require('shelljs');
const axios = require('axios');
const osCurrent = require('os').platform();

// Import Other Controllers
const { processQueue } = require('./queue');

// Import Tools
const { grabPath } = require('../tools/compatibility');
const { attemptToConvert, convertAssets, convertLegacyAssets, convertPre16Assets } = require('../tools/manifestConverter');
const { cauldronLogger } = require('../tools/logger');
const { checkInternet } = require('../tools/isClientOffline');
const NEW_LOGS = require('../controller-files/versions/logs-locations.json');
const { checkCompat } = require('./jvm');
const { destroySession } = require('../tools/sessionManager');

async function checkManifest(fileName, url, requiresConvert, type) {
    return new Promise(async (resolve, reject) => {
        var isOnline = await checkInternet();
        var CAULDRON_PATH = grabPath();
        try {
            var expected = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, fileName)));
            if (isOnline && !requiresConvert && type == 'main') {
                // Only Update Main Manifest
                downloadManifest(url, path.join(CAULDRON_PATH, fileName))
            }
            resolve(expected)
        } catch (err) {
            cauldronLogger.error(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadManifest(url, path.join(CAULDRON_PATH, fileName), requiresConvert, type);
                    resolve(downloadedFile);
                } catch (err) {
                    console.log(err)
                }

            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`)
            }
        }
    })
}

async function checkOther(fileName, url) {
    return new Promise(async (resolve, reject) => {
        var isOnline = await checkInternet();
        var CAULDRON_PATH = grabPath();
        try {
            var expected = fs.readFileSync(path.join(CAULDRON_PATH, fileName));
            resolve(expected)
        } catch (err) {
            cauldronLogger.error(`${fileName} not found trying to download`);
            if (isOnline) {
                try {
                    const downloadedFile = await downloadOther(url, path.join(CAULDRON_PATH, fileName))
                    resolve(downloadedFile);
                } catch (err) {
                    console.log(err)
                }

            } else {
                reject(`This Profile Cannot be launched offline. Please Launch it Online first`)
            }
        }
    })
}

async function downloadOther(url, dir) {
    return new Promise(async (resolve, reject) => {
        var config = {
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
        };
    })
};

var convertManifests = {
    'assets': convertAssets,
    'legacy': convertLegacyAssets,
    'pre-1.6': convertPre16Assets
};

async function downloadManifest(url, dir, requiresConvert, type) {
    return new Promise(async (resolve, reject) => {
        var config = {
            method: 'get',
            url: url
        };
        try {
            const file = await axios(config);
            shelljs.mkdir('-p', path.join(dir, '../'));
            var fileData = file.data;
            if (requiresConvert) {
                fileData = await convertManifests[type](fileData);
            }
            fs.writeFileSync(dir, JSON.stringify(fileData));
            resolve(fileData);
        } catch (err) {
            reject(err.message)
        };
    })
};

async function getJVMManifest() {
    // Used to Assist Packwiz on client.
    // not used in launcher
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {

            // JVM Manifests
            // Check For Meta
            const jvmMeta = await checkManifest(path.join('jvm', 'jvm-core.json'), 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json')
            const jvmCompat = await checkCompat(osCurrent, 'java-runtime-alpha', jvmMeta);
            if (jvmCompat) {
                var jvmMani = await checkManifest(path.join('jvm', 'java-runtime-alpha.json'), jvmCompat[0].manifest.url);
            } else {
                reject('Version Not Suppourted on ' + osCurrent);
            };

            var allManifiests = {
                jvmMeta: jvmMeta,
                jvmMani: jvmMani,
                jvmComp: 'java-runtime-alpha',
            };
            resolve(allManifiests);
        } catch (err) {
            reject(err);
        }

    })
}

async function getManifests(v, l, lv) {
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {
            // Check for asset file
            if (!fs.existsSync(path.join(CAULDRON_PATH, 'assets.json'))) {
                fs.writeFileSync(path.join(CAULDRON_PATH, 'assets.json'), '{}');
            };
            const assetDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'assets.json')));
            const getMain = await checkManifest('cauldron_version_manifest.json', 'https://launchermeta.mojang.com/mc/game/version_manifest.json', false, 'main');
            // Convert to Actual Values
            const { version, loaderVersion, loader } = await whatIsThis(v, l, lv, getMain);
            const foundVersionData = getMain.versions.find(versionName => versionName.id === version);
            if (!foundVersionData) {
                throw new Error('Version Not Found')
            };
            //console.log(foundVersionData)
            const getSpec = await checkManifest(path.join('versions', foundVersionData.id, foundVersionData.id + '.json'), foundVersionData.url);
            if (loader != 'vanilla') {
                //createdManifest = await loaderFunctions[loader](lVersion, version, foundVersion);
            } else {
                createdManifest = await attemptToConvert(getSpec);
            };
            if (createdManifest.logging) {
                var grabLogging = await checkOther(path.join('assets', 'log_configs', createdManifest.logging.client.file.id), NEW_LOGS[createdManifest.logging.client.file.id].url);
            } else {
                cauldronLogger.warn("Destroying Session: No Logger Detected. Game will still boot");
                destroySession();
            }
            console.log(createdManifest.downloads.client.url)
            const grabClient = await checkOther(path.join('versions', createdManifest.id, createdManifest.id + '.jar'), createdManifest.downloads.client.url);

            // Check for Duplicates in Libs
            var libs = createdManifest.libraries;
            const ids = libs.map(o => o.name)
            const filtered = libs.filter(({ name }, index) => !ids.includes(name, index + 1));
            createdManifest.libraries = filtered;

            // JVM Manifests

            // Check For Meta
            const jvmMeta = await checkManifest(path.join('jvm', 'jvm-core.json'), 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json')
            const jvmCompat = await checkCompat(osCurrent, createdManifest.javaVersion.component, jvmMeta);
            if (jvmCompat) {
                var jvmMani = await checkManifest(path.join('jvm', createdManifest.javaVersion.component + '.json'), jvmCompat[0].manifest.url);
            } else {
                reject('Version Not Suppourted on ' + osCurrent);
            };
            // Assets
            const assetMani = await checkManifest(path.join('assets', 'indexes', createdManifest.assets + '.json'), createdManifest.assetIndex.url);
            var specCond = createdManifest.assets
            if (createdManifest.assets != 'legacy' && createdManifest.assets != 'pre-1.6') {
                specCond = 'assets'
            };
            const assetsConverted = await checkManifest(path.join('assets', 'indexes', createdManifest.assets + '-cauldron.json'), createdManifest.assetIndex.url, true, specCond);

            var allManifiests = {
                main: getMain,
                spec: createdManifest,
                logging: grabLogging,
                jvmMeta: jvmMeta,
                jvmMani: jvmMani,
                jvmComp: createdManifest.javaVersion.component,
                assets: assetMani,
                aseetsInfo: assetsConverted,
                version: version,
                versionData: { loader: loader, version: version, loaderVersion: loaderVersion },
                loader: loader,
                assetsDownloaded: assetDict[createdManifest.assets],
                loaderVersion: loaderVersion
            };
            resolve(allManifiests);


        } catch (err) {
            reject(err);
        }

    })
};


// What Is This? Function
// Helps convert terms like release and snapshot into actual versions
// Also grabs information for the selected loader (like loader version)

async function whatIsThis(version, loader, lVersion, MANIFEST) {
    if (!loader) {
        loader = 'vanilla';
    };
    var versionFound = "";
    if (version == 'release' || version == 'latest') {
        versionFound = MANIFEST.latest.release;
    } else if (version == 'snapshot') {
        versionFound = MANIFEST.latest.snapshot;
    } else {
        versionFound = version
    };
    var rObject = { version: versionFound, loaderVersion: '', loader: loader }
    try {
        if (loader != 'vanilla') {
            if (!lVersion) {
                // Needs Changing
                //lVersion = await versionFunctions[loader](versionFound,'recommended');
            };
            rObject.loaderVersion = lVersion;
        };
    } catch (err) {
        //console.log(err)
        throw new Error(err)
    };
    return rObject;
};


module.exports = { getManifests, getJVMManifest }