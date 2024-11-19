const fs = require('fs');
const shelljs = require('shelljs');
const path = require('path');

const { cauldronLogger } = require('../tools/logger');
const { verifyInstallation } = require('./queue');
const { grabPath, getOperatingSystem } = require('../tools/compatibility');
const { startProgress } = require('../tools/progress');
async function checkCompat(jVersion,jvmData) {
    var actualPlatform = getOperatingSystem(true);
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
        if (getOperatingSystem() == 'linux') {
            await shelljs.chmod('+x', path.join(CAULDRON_PATH,'jvm',name,'bin','java'));
        };
        cauldronLogger.info(`Java Installation Verified`);
        var currentJVMFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'jvm_installed.json')));
        var jvmObj = {
            installed:true,
            lastChecked:new Date().getTime()
        };
        currentJVMFile[name] = jvmObj;
        fs.writeFileSync(path.join(CAULDRON_PATH, 'jvm_installed.json'), JSON.stringify(currentJVMFile));
        resolve(true);
    })
};



module.exports = { checkCompat, checkJVM }