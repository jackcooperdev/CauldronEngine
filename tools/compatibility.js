const osCurrent = require('os').platform();
const archCurrent = require('os').arch();
const path = require('path')
const homedir = require('os').homedir();
const fs = require('fs');
const shell = require('shelljs');
var configData = {};




function grabPath() {
    const WORKING_DIR = '.cauldron';
    if (osCurrent == 'win32') {
        pathReturn = path.join(homedir, 'AppData', 'Roaming', WORKING_DIR)
    } else if (osCurrent == 'linux' || osCurrent == 'darwin') {
        pathReturn = path.join(homedir, WORKING_DIR);
    }
    shell.mkdir('-p', path.join(pathReturn))
    return pathReturn

};

var osConvertStandard = { 'win32': 'windows', 'linux': 'linux', 'darwin': 'osx' };

function getOperatingSystem(isJVM) {
    if (!isJVM) {
        var actualOS = osConvertStandard[osCurrent];
        if (!actualOS) {
            throw new Error('Unsupported Operating System')
        } else {
            return actualOS;
        }
    } else {
        var actualOS = osConvertStandard[osCurrent];
        if (!actualOS) {
            throw new Error('Unsupported Operating System')
        } else {
            if (actualOS == 'linux') {
                return actualOS
            };
            if (actualOS == 'windows') {
                if (archCurrent == 'x64') {
                    return 'windows-x64'
                } else if (archCurrent.includes("arch")) {
                    return 'windows-arm64'
                } else {
                    return 'windows-x86'
                }
            };

            if (actualOS == 'darwin') {
                if (archCurrent.includes('arm')) {
                    return 'mac-os-arm64'
                };
            } else {
                return 'macos'
            }

        }

    }

}


module.exports = { grabPath, getOperatingSystem };