const fs = require('fs');
const homedir = require('os').homedir();
const path = require('path');
const shelljs = require('shelljs');
const axios = require('axios');

// Import Other Controllers
const { processQueue } = require('./queue');

// Import Tools
const { checkForValidFiles, downloadVersionManifests } = require('../tools/downloader');
const { grabPath } = require('../tools/compatibility');
const { attemptToConvert } = require('../tools/manifestConverter');
const { cauldronLogger } = require('../tools/logger');


// Grab Plugins
const { getForgeVersion, getForgeManifest, grabForgeProcs, checkInstaller } = require('../plugins/forge');

// Declare Variables
var local_manifest = "";
var versionCache = "";
var CAULDRON_PATH = grabPath();

// Important Links
const MAIN_MANIFEST = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const NEW_LOGS = require('../controller-files/versions/logs-locations.json');


// Declare loader functions
var loaderFunctions = {
    'forge':getForgeManifest
};

var versionFunctions = {
    'forge':getForgeVersion
};

var versionVerifiers = {
    'forge':checkInstaller
};

// Functions


// What Is This? Function
// Helps convert terms like release and snapshot into actual versions
// Also grabs information for the selected loader (like loader version)

async function whatIsThis(version, loader, lVersion) {
    if (!loader) {
        loader = 'vanilla';
    };
    const MANIFEST = await downloadVersionManifests(MAIN_MANIFEST, true, false);
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
                lVersion = await versionFunctions[loader](versionFound,'recommended');
            };
            rObject.loaderVersion = lVersion;
        };
    } catch (err) {
        throw new Error(err)
    };
    return rObject;
};

// Verify and Find Manifest
// Verifies that version exists and builds manifest fir version
// Also aquires log and version file

async function verifiyAndFindManifest(version, loader, lVersion) {
    return new Promise(async (resolve,reject) => {
        try {
            const MANIFEST = await downloadVersionManifests(MAIN_MANIFEST, true, false);
            // Aquire URL for Individual Manifest
            const foundVersionData = MANIFEST.versions.find(versionName => versionName.id === version);
            // Get Indivdual Manifest
            const foundVersion = await downloadVersionManifests(foundVersionData.url, true, path.join('versions', foundVersionData.id), foundVersionData.id);

            //Grab version manifest
            if (loader != 'vanilla') {
                createdManifest = await loaderFunctions[loader](lVersion, version, foundVersion);
            } else {
                createdManifest = await attemptToConvert(foundVersion);
            };

            //Create Queues for Log and Version
            var dQueue = new Array();

            if (createdManifest.logging) {
                var obj = {
                    origin: NEW_LOGS[createdManifest.logging.client.file.id].url,
                    sha1: NEW_LOGS[createdManifest.logging.client.file.id].sha1,
                    destination: path.join(CAULDRON_PATH, 'assets', 'log_configs'),
                    fileName: createdManifest.logging.client.file.id
                };
                dQueue.push(obj);
            };
            var obj2 = {
                origin: createdManifest.downloads.client.url,
                sha1: createdManifest.downloads.client.sha1,
                destination: path.join(CAULDRON_PATH, 'versions', createdManifest.id),
                fileName: createdManifest.id + '.jar'
            };
            dQueue.push(obj2);
            
            //Process Queue
            var checkForFiles = await processQueue(dQueue, 2, 'checksum')
                while (checkForFiles.length != 0) {
                    cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
                    cauldronLogger.info('Downloading Files');
                    const handleDownload = await processQueue(checkForFiles, 2, 'download');
                    var checkForFiles = await processQueue(checkForFiles, 100, 'checksum');
                };
            cauldronLogger.info(`Checksums Passed Install is Valid!`);

            // Check for Duplicates
            var libs = createdManifest.libraries;
            const ids = libs.map(o => o.name)
            const filtered = libs.filter(({ name }, index) => !ids.includes(name, index + 1));
            createdManifest.libraries = filtered;

            resolve(createdManifest);
        } catch (err) {
            console.log(err);
            reject(err);
        };

    });
};











module.exports = { whatIsThis, verifiyAndFindManifest }
