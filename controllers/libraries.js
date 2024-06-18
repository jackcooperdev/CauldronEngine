const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const homedir = require('os').homedir()
const { grabPath, getConfig } = require('../tools/compatibility');
var CAULDRON_PATH = grabPath();
const { checkForValidFiles, downloadVersionManifests } = require('../tools/downloader');
const { processQueue } = require('./queue');
const StreamZip = require('node-stream-zip');
const { cauldronLogger } = require('../tools/logger');
const { getSession } = require('../tools/sessionManager');
var osConvert = { 'win32': 'windows', 'linux': 'linux' }

const conifgMain = getConfig();

async function getLibraries(libData, os, versionData) {
    return new Promise(async (resolve, reject) => {
        try {
            if (versionData.loader == 'vanilla') {
                version = versionData.version;
            } else if (versionData.loader == 'forge') {
                version = `forge-${versionData.version}-${versionData.loaderVersion}`;
            };
            var acutalOS = osConvert[os];
            var dQueue = new Array();
            var libArray = new Array();
            cauldronLogger.info(`Operating System: ${acutalOS}`)
            for (idx in libData) {
                libAllowed = true;
                if (libData[idx].rules) {
                    for (rIdx in libData[idx].rules) {
                        if (libData[idx].rules[rIdx].action == "allow") {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name != acutalOS) {
                                    libAllowed = false;
                                };
                            };
                        } else {
                            if (libData[idx].rules[rIdx].os) {
                                if (libData[idx].rules[rIdx].os.name == acutalOS) {
                                    libAllowed = false;
                                };
                            };
                        }
                    }
                }
                if (libAllowed) {
                    if (libData[idx].downloads.artifact) {
                        shell.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', libData[idx].downloads.artifact.path, '../'))
                        var obj = {
                            origin: libData[idx].downloads.artifact.url,
                            sha1: libData[idx].downloads.artifact.sha1,
                            destination: path.join(CAULDRON_PATH, 'libraries', libData[idx].downloads.artifact.path, '../'),
                            fileName: libData[idx].downloads.artifact.path.split("/")[libData[idx].downloads.artifact.path.split("/").length - 1]
                        };
                        dQueue.push(obj);
                        libArray.push(path.join(obj.destination, obj.fileName));
                    };
                    if (libData[idx].downloads.classifiers) {
                        var natives = libData[idx].downloads.classifiers[libData[idx].natives[acutalOS]];
                        
                        if (!natives) {
                            if (libData[idx].natives[acutalOS].includes("arch")) {
                                var newOS = `natives-${acutalOS}-64`
                                natives = libData[idx].downloads.classifiers[newOS];
                            }
                        }
                        if (natives) {
                            var needsExtracting = libData[idx].extract;
                            var obj = {
                                origin: natives.url,
                                sha1: natives.sha1,
                                destination: path.join(CAULDRON_PATH, 'bin', getSession()),
                                fileName: natives.path.split("/")[natives.path.split("/").length - 1]
                            };
                            var checkForNative = await processQueue([obj], 1, 'checksum');
                            var extractFile = false;
                            while (checkForNative.length != 0) {
                                const handleDownload = await processQueue(checkForNative, 1, 'download');
                                checkForNative = await processQueue(checkForNative, 1, 'checksum');
                                extractFile = true
                            };
                            if (extractFile) {
                                const zip = new StreamZip.async({ file: path.join(obj.destination, obj.fileName) });
                                const entriesCount = await zip.entriesCount;
                                const entries = await zip.entries();
                                for (const entry of Object.values(entries)) {
                                    if (!entry.name.includes("META-INF") && !entry.name.includes(".git") && !entry.name.includes(".sha1")) {
                                        await zip.extract(entry.name, path.join(CAULDRON_PATH,'bin',getSession()));
                                    };
                                };
                                zip.close();
                                fs.rmSync(path.join(CAULDRON_PATH, 'bin', getSession(), obj.fileName))
                            }
                        };
                    };
                };
            };

            var checkForFiles = await processQueue(dQueue, 1000, 'checksum');
            var tryCount = 0;
            while (checkForFiles.length != 0 && tryCount < 4) {
                cauldronLogger.info(`Total Files (${dQueue.length}) Files to Download (${checkForFiles.length})`);
                cauldronLogger.info('Downloading Files');
                const handleDownload = await processQueue(checkForFiles, 5, 'download');
                checkForFiles = await processQueue(dQueue, 1000, 'checksum');
                //console.log(checkForFiles)
                tryCount++;
            };
            cauldronLogger.info(`Checksums Passed Install is Valid!`);
            resolve(libArray);
        } catch (err) {
            reject(err);
        }

    })
}

module.exports = { getLibraries }