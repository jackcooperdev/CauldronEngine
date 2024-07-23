const fs = require('fs');
const shelljs = require('shelljs');
const path = require('path');

const { cauldronLogger } = require('../tools/logger');
const { verifyInstallation } = require('./queue');
const { grabPath } = require('../tools/compatibility');

const platform_convert = { 'win32': 'windows-x64','linux':'linux' };

async function checkCompat(platform, jVersion,jvmData) {
    var actualPlatform = platform_convert[platform];
    if (jvmData[actualPlatform][jVersion] != undefined) {
        return jvmData[actualPlatform][jVersion];
    } else {
        return false;
    }
};

async function checkJVM(name, jvmMani) {
    return new Promise(async (resolve) => {
        var CAULDRON_PATH = grabPath();
        shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'jvm', name));
        fs.writeFileSync(path.join(CAULDRON_PATH, 'jvm', name + '.json'), JSON.stringify(jvmMani));
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
        var checkForFiles = await verifyInstallation(dQueue);
        cauldronLogger.info(`Java Installation Verified`);
        resolve(true);
    })
};



module.exports = { checkCompat, checkJVM }