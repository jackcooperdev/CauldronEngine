const fs = require('fs')
const path = require('path');
const { getForgeVersion } = require('../plugins/forge');

function grabBlockedVersions(loader) {
    if (!loader || loader == 'vanilla') {
        var bFile = JSON.parse(fs.readFileSync(path.join(__dirname,'../','controller-files','blocked_versions.json')));
        return bFile;
    } else {
        var bFile = JSON.parse(fs.readFileSync(path.join(__dirname,'../','plugins',`${loader}-files`,'blocked_versions.json')));
        return bFile;
    }
};

var loaderVersionsFun = {
    'forge': getForgeVersion
};

function grabLoaderVersion(loader, version) {
    try {
        var loaderVersion = loaderVersionsFun[loader](version);
        return loaderVersion;
    } catch (err) {
        return false;
    };
};

module.exports = {grabBlockedVersions,grabLoaderVersion}