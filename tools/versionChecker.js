const fs = require('fs')
const path = require('path');
const { getForgeVersion } = require('../plugins/forge');

function grabBlockedVersions(loader) {
    if (!loader || loader == 'vanilla') {
        var bFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../', 'controller-files', 'blocked_versions.json')));
        return bFile;
    } else {
        var bFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../', 'plugins', `${loader}-files`, 'blocked_versions.json')));
        return bFile;
    }
};

var loaderVersionsFun = {
    'forge': getForgeVersion
};

async function grabLoaderVersion(loader, version) {
    return new Promise(async (resolve, reject) => {
        try {
            var loaderVersion = await loaderVersionsFun[loader](version);
            resolve(loaderVersion)
        } catch (err) {
            if (err == 'Version Does Not Exist') {
                reject(err)
            } else {
                reject(`${loader} not supported`)
            }
        };
    })
};

module.exports = { grabBlockedVersions, grabLoaderVersion }