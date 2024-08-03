const { cauldronLogger } = require('../../tools/logger');
var unsupportedVersions = require('./files/blocked_versions.json');



// Grabs ForgeVersion from ForgePromo
// Attempts to find recommended version else forces latest
// Fails if in blacklist or version does not exist
async function identifier(version, forgePromos) {
    return new Promise(async (resolve, reject) => {

        type = 'recommended';

        if (unsupportedVersions.includes(version)) {
            reject(`Sorry but Cauldron does not support ${version} forge yet. CODE: BLVER`);
        };
        var forgeVersion = forgePromos.promos[`${version}-${type}`];
        if (!forgeVersion) {
            forgeVersion = forgePromos.promos[`${version}-latest`];
            if (!forgeVersion) {
                reject('Version Does Not Exist')
            }
        };
        cauldronLogger.info("Forge Plugin Created By @jackcooper04");
        cauldronLogger.warn("Forge is still experimental. Expect Crashes");
        resolve(forgeVersion);
    })
};


module.exports = { identifier };