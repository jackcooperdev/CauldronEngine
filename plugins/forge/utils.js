const path = require('path');
const fs = require('fs');
const axios = require('axios');



const { grabPath } = require("../../tools/compatibility");

// Important Links
const FORGE_REPO = "https://maven.minecraftforge.net/net/minecraftforge";


// Files
var suffixes = require('./files/suffixes.json');

// Get Forge Installer URL (does what it says on the tin)
async function getForgeInstallerURL(version, forgeVersion) {
    var url = "";
    var CAULDRON_PATH = grabPath();
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
        };
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
    var verifyInstaller = await checkInstaller(url);
    if (verifyInstaller) {
        return url;
    } else {
        throw new Error(`Sorry but Cauldron does not support ${version} - ${forgeVersion} forge yet. CODE: URLNFOUNDB`);
    };
};


// Checks Installer Link to see if its valid
async function checkInstaller(url) {
    var config = {
        method: 'get',
        url: url
    };
    try {
        console.log(url)
        const res = await axios(config);
        return true;
    } catch (err) {
        return false;
    };
};

function convertNameToPath(name) {
    var split = name.split(":");
    var chunkOne = split[0].split(".").join("/");
    var chunkTwo = split[1];
    var chunkThree = split[2];
    return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
};
// Util Functions
function getSuffixUsed() {
    return suffixUsed;
};
module.exports = { getForgeInstallerURL,convertNameToPath, getSuffixUsed }