const { getAssets } = require("./assets");
const { login, authenticate } = require("./auth");
const { checkJVM, checkCompat, downloadJVM } = require("./jvm");
const { getLibraries } = require("./libraries");
const { whatIsThis, verifiyAndFindManifest, getCache } = require("./versions");
const osCurrent = require('os').platform();
const path = require('path')
const configMain = require('../config.json');
const fs = require('fs');
const { exec } = require('child_process');
const shell = require('shelljs');
const { attemptToConvert, buildJVMRules, buildGameRules, buildFile } = require("../tools/launchBuilder");
const { grabPath } = require('../tools/compatibility');
const { cauldronLogger } = require('../tools/logger');
const { downloadVersionManifests } = require("../tools/downloader");
const { grabForgeProcs, postProcessing } = require("../plugins/forge");
const { createSession, destroySession } = require("../tools/sessionManager");
var CAULDRON_PATH = grabPath();
const homedir = require('os').homedir()
const MAIN_MANIFEST = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

var game_status = false;

var injector = {
    create: (function () {
        var regexp = /\${([^{]+)}/g;

        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? '' : key;
            });
        }
    })()
};

var additFun = {
    'forge': postProcessing
}


async function launchGame(version, email, dry, loader,lVersion) {
    if (!dry) {
        dry = false;
    };
    if (!loader) {
        loader = 'vanilla';
    };
    return new Promise(async (resolve) => {
        try {
            var sessionID = createSession();
            cauldronLogger.info("Session ID: " + sessionID);
            cauldronLogger.info(`Version Verified and Manifest Found`);
            if (!dry) {
                cauldronLogger.info(`Starting Auth Flow For User ${email}`);
                loggedUser = await authenticate(email);
                cauldronLogger.info('Authentication Passed');
            };
            const updateLocalManififest = await downloadVersionManifests(MAIN_MANIFEST, true, false);
            cauldronLogger.info('Version Requested: ' + version);
            cauldronLogger.info('Loader Requested: ' + loader)
            const setVersion = await whatIsThis(version, loader,lVersion);
            cauldronLogger.info(`Finding Info for loader ${loader} for version ${version}`)
            if (loader != 'vanilla') {
                cauldronLogger.info(`${loader} version ${setVersion.loaderVersion} found`);
            };
            const convertedManifest = await verifiyAndFindManifest(setVersion.version, loader, setVersion.loaderVersion);
            cauldronLogger.info(`Checking JVM Version Needed For ${setVersion.version} on ${osCurrent}`);
            jreVersion = convertedManifest.javaVersion.component;
            cauldronLogger.info(`Version Needed is ${jreVersion}`);
            const checkCompatRes = await checkCompat(osCurrent, jreVersion)
            cauldronLogger.info('Checking For Install and Downloading if Missing')
            const jvmDown = await checkJVM(checkCompatRes[0].manifest.url, jreVersion);
            if (loader != 'vanilla') {
                var addit = await additFun[loader](setVersion, convertedManifest);
            };
            cauldronLogger.info('Starting Asset Download');
            cauldronLogger.info(`Index No: ${convertedManifest.assets}`);
            cauldronLogger.info(`Index URL: ${convertedManifest.assetIndex.url}`)
            const assetGet = await getAssets(convertedManifest.assets, convertedManifest.assetIndex.url)
            cauldronLogger.info('Starting Library Download')
            const libGet = await getLibraries(convertedManifest.libraries, osCurrent, setVersion);
            if (!dry) {
                cauldronLogger.info('All Files Aquired Building Launch File');
                cauldronLogger.info('Creating JVM Arguments');
                var validRules = await buildJVMRules(convertedManifest, libGet, setVersion);
                cauldronLogger.info('Generating Game Arguments')
                var gameRules = await buildGameRules(convertedManifest, loggedUser, setVersion);
                var launchPath = await buildFile(convertedManifest, jreVersion, validRules, gameRules);
                cauldronLogger.info('Starting Game');
                const exe = exec(`cd ${CAULDRON_PATH} && ${launchPath}`);
            } else {
                destroySession();
                cauldronLogger.info("Game Installed");
            }
            resolve(true)

        } catch (err) {
            cauldronLogger.error(err.message);
            resolve(false)
        }

    })

};


module.exports = { launchGame };