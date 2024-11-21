const path = require('path');
const fs = require('fs');
const axios = require('axios');



const { grabPath } = require("../../tools/compatibility");

// Important Links
const FORGE_REPO = "https://maven.minecraftforge.net/net/minecraftforge";


// Files
let suffixes = require('./files/suffixes.json');
let suffixUsed = "";
// Get Forge Installer URL (does what it says on the tin)
async function getForgeInstallerURL(version, forgeVersion) {
    let url = "";
    let CAULDRON_PATH = grabPath();
    if (!fs.existsSync(path.join(CAULDRON_PATH,'forge-installers.json'))) {
        aquiredForges = {}
        fs.writeFileSync(path.join(CAULDRON_PATH,'forge-installers.json'),'{}');
    } else {
        aquiredForges = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH,'forge-installers.json')))
    };
    if (aquiredForges[`${version}-${forgeVersion}`]) {
        url = aquiredForges[`${version}-${forgeVersion}`].url;
        if (aquiredForges[`${version}-${forgeVersion}`].suffix) {
            suffixUsed = aquiredForges[`${version}-${forgeVersion}`].suffix
        }
    } else {
        if (suffixes[version]) {
            for (idx in suffixes[version]) {
                url = `${FORGE_REPO}/forge/${version}-${forgeVersion}${suffixes[version][idx]}/forge-${version}-${forgeVersion}${suffixes[version][idx]}-installer.jar`;
                const validateURL = await checkInstaller(url);
                suffixUsed = suffixes[version][idx]
                if (validateURL) {
                    aquiredForges[`${version}-${forgeVersion}`] = {url:'',suffix:''};
                    aquiredForges[`${version}-${forgeVersion}`]['url'] = url;
                    aquiredForges[`${version}-${forgeVersion}`]['suffix'] = suffixUsed;
                    fs.writeFileSync(path.join(CAULDRON_PATH,'forge-installers.json'),JSON.stringify(aquiredForges))
                    break;
                };
            };
        } else {
            aquiredForges[`${version}-${forgeVersion}`] = {url:'',suffix:''};
            url = `${FORGE_REPO}/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
            aquiredForges[`${version}-${forgeVersion}`]['url'] = url;
            fs.writeFileSync(path.join(CAULDRON_PATH,'forge-installers.json'),JSON.stringify(aquiredForges));
        };
        if (!url) {
            throw new Error(`Sorry but Cauldron does not support ${version} - ${forgeVersion} forge yet. CODE: URLNFOUNDA`);
        };
    };
    let verifyInstaller = await checkInstaller(url);
    if (verifyInstaller) {
        return url;
    } else {
        throw new Error(`Sorry but Cauldron does not support ${version} - ${forgeVersion} forge yet. CODE: URLNFOUNDB`);
    };
};


// Checks Installer Link to see if its valid
async function checkInstaller(url) {
    let config = {
        method: 'get',
        url: url
    };
    try {
        const res = await axios(config);
        return true;
    } catch (err) {
        return false;
    };
};

function convertNameToPath(name) {
    let split = name.split(":");
    let chunkOne = split[0].split(".").join("/");
    let chunkTwo = split[1];
    let chunkThree = split[2];
    return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
};
// Util Functions
function getSuffixUsed() {
    if (!suffixUsed) {
        suffixUsed = '';
    }
    return suffixUsed;
};
module.exports = { getForgeInstallerURL,convertNameToPath, getSuffixUsed }