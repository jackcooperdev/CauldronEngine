const fs = require('fs');
const shelljs = require('shelljs');
const path = require('path');
const homedir = require('os').homedir();
const { cauldronLogger } = require('../tools/logger');
const conifgMain = require('../config.json');
const {  extract, checkForValidFiles,downloadVersionManifests } = require('../tools/downloader');
const { processQueue } = require('./queue');
const JVM_CORE = "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
const platform_convert = { 'win32': 'windows-x64','linux':'linux' };
const { grabPath } = require('../tools/compatibility');
var CAULDRON_PATH = grabPath();
var jvmData = "";


async function aquireJVMMeta() {
    jvmData = await downloadVersionManifests(JVM_CORE, false, false);
};

async function checkCompat(platform, jVersion) {
    await aquireJVMMeta();
    var actualPlatform = platform_convert[platform];
    if (jvmData[actualPlatform][jVersion] != undefined) {
        return jvmData[actualPlatform][jVersion];
    } else {
        return false;
    }
};

async function checkJVM(url, name) {
    return new Promise(async (resolve) => {
        var jvmMani = await downloadVersionManifests(url, false, false);
        shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'jvm', name));
        fs.writeFileSync(path.join(CAULDRON_PATH, 'jvm', name + '.json'), JSON.stringify(jvmMani));
        (jvmMani)
        var files = jvmMani.files;
        // Build Dir Structure
        for (idx in files) {
            if (files[idx].type == "directory") {
                shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'jvm', name, idx));
            };
        };
        var compressedFiles = new Array();
        var dQueue = new Array();
        for (sIdx in files) {
            if (files[sIdx].type == "file") {
                var downloadPath = path.join(CAULDRON_PATH, 'jvm', name, sIdx)
                try {
                    if (files[sIdx].executable) {
                        downUrl = files[sIdx].downloads.lzma.url;
                        compressedFiles.push({ origin: sIdx, path: destination,fileName:sIdx.split("/")[sIdx.split("/").length - 1] });
                    } else {
                        downUrl = files[sIdx].downloads.raw.url;
                    }
                } catch (err) {
                    downUrl = files[sIdx].downloads.raw.url;
                };
                dQueue.push({ origin: downUrl, destination: path.join(downloadPath, '../',),sha1: files[sIdx].downloads.raw.sha1,fileName:sIdx.split("/")[sIdx.split("/").length - 1] });
            }
        };
        var checkForFiles = await processQueue(dQueue, 1000, 'checksum');
        var test = false;
        while (checkForFiles.length != 0) {
            cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
            cauldronLogger.info('Downloading Files');
            const handleDownload = await processQueue(checkForFiles, 3, 'download');
            cauldronLogger.info('Files Downloaded! Decompressing');
            const unzipFiles = await processQueue(compressedFiles, 3, 'unzip')
            checkForFiles = await processQueue(checkForFiles, 1000, 'checksum');
        };
        cauldronLogger.info(`Checksums Passed Install is Valid!`);
        resolve(true);
    })
};



module.exports = { aquireJVMMeta, checkCompat, checkJVM }