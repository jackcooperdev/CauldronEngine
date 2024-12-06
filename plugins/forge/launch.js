const {grabPath} = require("../../tools/compatibility");
let forceComp = require('./files/force_compat.json');
const path = require('path')

async function jvm(data) {
    return new Promise(async (resolve, reject) => {
        try {
            let CAULDRON_PATH = grabPath();
            let {manifest, libraryList, versionData, overrides} = data;
            // If the version is at or above 1.20.3 then assume force compat is required.
            if (versionData.version.split(".").join("") >= 1203) {
                forceComp[versionData.version] = [
                    "client",
                    "universal"
                ]
            }
            if (forceComp[versionData.version]) {
                if (forceComp[versionData.version][0] === 'legacy') {
                    // Legacy Compat
                    libraryList.push(path.join(CAULDRON_PATH, 'libraries', 'net/minecraftforge/minecraftforge', versionData.loaderVersion, `minecraftforge-${versionData.version}-${versionData.loaderVersion}.jar`));

                }
                for (let fIdx in forceComp[versionData.version]) {
                    libraryList.push(path.join(CAULDRON_PATH, 'libraries', 'net/minecraftforge/forge', `${versionData.version}-${versionData.loaderVersion}`, `forge-${versionData.version}-${versionData.loaderVersion}-${forceComp[versionData.version][fIdx]}.jar`));
                }
            }


            resolve({manifest, libraryList, versionData, overrides})
        } catch (err) {
            reject(err)
        }

    })
}

module.exports = {jvm}