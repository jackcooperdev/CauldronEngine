const VERIFIED_LOADERS = require('../files/verifiedLoaders.json');
const PATCHES = require('../files/patches.json');
const { cauldronLogger } = require('../tools/logger');
const { getOperatingSystem, grabPath } = require('../tools/compatibility');
const { createUUID, inRange } = require('../tools/fileTools');
const { getCEObject } = require('./manifest');
const { verifyInstallation } = require('./queue');
const { logInjector, buildJVMRules, buildGameRules, buildFile } = require('../tools/launchBuilder');
const { startLegacyLogging, EXIT_MARKER } = require('../tools/legacyLogger');
const path = require('path')
const JSZip = require('jszip');
const fs = require('fs')
const { spawn } = require("child_process");
const { postProcessing } = require('../tools/postProcessor');
async function startGame(version, loaderInfo, authInfo, overrides) {
    return new Promise(async (resolve, reject) => {
        try {
            const CE_OBJECT = await installGame(version, loaderInfo);
            let CAULDRON_PATH = grabPath();
            let sessionID = createUUID();
            if (!overrides) {
                overrides = { jvm: {}, game: {}, additG: {} };
            }
            fs.mkdirSync(path.join(CAULDRON_PATH, '.temp'), { recursive: true })

            // Setup Logger
            let rawLog = null;
            const legacyLogging = !CE_OBJECT.loggingInfo;
            if (legacyLogging) {
                const sessionDir = path.join(CAULDRON_PATH, 'sessionLogs', sessionID);
                fs.mkdirSync(sessionDir, { recursive: true });
                rawLog = path.join(sessionDir, 'raw.log');
            } else {
                await logInjector(path.join(CAULDRON_PATH, 'assets', 'log_configs', CE_OBJECT.loggingInfo.id), sessionID, true);
            }

            // Grab Spec File
            const SPEC_FILE = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, CE_OBJECT.specPath)).toString())


            // Aquire Natives

            let nativeList = CE_OBJECT.nativeList;

            const IGNORE_LIST = ["META-INF", ".git", ".sha1"];

            for (let native of nativeList) {
                const data = fs.readFileSync(native);
                const zip = await JSZip.loadAsync(data)
                const relFiles = Object.keys(zip.files).filter(
                    file => !IGNORE_LIST.some(ignored => file.includes(ignored))
                );
                for (let relFile of relFiles) {
                    const fileBuffer = await zip.files[relFile].async('nodebuffer')
                    fs.writeFileSync(path.join(CAULDRON_PATH, '.temp', relFile), fileBuffer)
                }
            };

            // Apply Patches
            let patchIdent = CE_OBJECT.patchIdentifier;
            let patchLibrary = CE_OBJECT.patches;

            // Check if LegacyPatcher is needed
            let patchLegacy = false;

            /*   if (inRange(patchIdent, 1, 84)) {
                  let mode = 1;
  
                  let legacyPatchPath = path.join(CAULDRON_PATH, 'libraries', patchLibrary[0].downloads.artifact.path);
  
                  // Copy LegacyFix to temp dir;
                  fs.copyFileSync(legacyPatchPath, path.join(CAULDRON_PATH, '.temp', 'legacyfix.jar'));
  
                  if (inRange(patchIdent, 1, 56)) {
                      mode++;
                  }
                  patchLegacy = mode;
                  cauldronLogger.debug(`Applying LegacyPatcher (Mode ${mode})`);
              }; */

            // Create JVM Rules
            const validRules = await buildJVMRules(SPEC_FILE, CE_OBJECT.libList, { version }, overrides.jvm, patchLegacy);

            // Build Game Rules

            const gameRules = await buildGameRules(SPEC_FILE, authInfo, overrides.game);

            let launchDirectory = `${CAULDRON_PATH}`;
            if (overrides["game"]) {
                if (overrides["game"]["game_directory"]) {
                    launchDirectory = `${overrides["game"]["game_directory"]}`;
                }
            }


            // Patch Launch Arguments

            // Patch Version Type Bug on Early Snapshots (Removes versionType param)
            if (inRange(patchIdent, 85, 92)) {
                const i = gameRules.indexOf('--versionType');
                if (i !== -1) gameRules.splice(i, 2);
            }

            // Patch Game Dir Being Hardcoded to User Home (Sets Home Dir Flag in Java)
            if (inRange(patchIdent, 1, 84)) {
                validRules.push(`-Duser.home=${launchDirectory}`)
            }


            // Build Launch Script
            const launchPath = await buildFile(SPEC_FILE, CE_OBJECT.jreVersion, validRules, gameRules);

            // Launch Game
            const isWindows = getOperatingSystem() === 'windows';
            const dirToDelete = path.join(CAULDRON_PATH, '.mode')

            const redirect = rawLog ? ` >> "${rawLog}" 2>&1` : '';
            const exitMark = rawLog
                ? (isWindows ? ` & echo ${EXIT_MARKER}>> "${rawLog}"` : `; echo "${EXIT_MARKER}" >> "${rawLog}"`)
                : '';

            const winCommand = `cd /d "${launchDirectory}" && call "${launchPath}"${redirect}${exitMark} & cd /d "%TEMP%" & rmdir /s /q "${dirToDelete}"`;
            const child = isWindows
                ? spawn('cmd', ['/d', '/s', '/c', `"${winCommand}"`], {
                    windowsVerbatimArguments: true,
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                })
                : spawn('sh', ['-c', `cd "${launchDirectory}" && "${launchPath}"${redirect}${exitMark}; cd / && rm -rf "${dirToDelete}"`], {
                    detached: true,
                    stdio: 'ignore'
                });
            child.unref();
            console.log(rawLog)
            if (rawLog) startLegacyLogging(rawLog);
            resolve(sessionID);


        } catch (e) {
            reject(e)
        }





    })
}



async function installGame(version, loaderInfo) {
    return new Promise(async (resolve, reject) => {
        try {

            let start = new Date();
            if (!loaderInfo) {
                loaderInfo = { type: 'vanilla' };
            };


            const loaderAccepted = VERIFIED_LOADERS.includes(loaderInfo.type);
            if (!loaderAccepted) {
                cauldronLogger.error('Loader Not Supported! Defaulting to Vanilla')
                loaderInfo.type = 'vanilla'
            };

            let installObject = {
                version,
                loader: loaderInfo.type,
                lv: loaderInfo.version,
            };
            if (!installObject.lv) {
                installObject.lv = 'release'
            }

            const fullOperatingSystem = getOperatingSystem(true);

            let foundPatches = PATCHES.filter(obj => obj.affected_operating_systems.includes(fullOperatingSystem) && obj.affected_versions.includes(installObject.version))

            for (let patch of foundPatches) {
                cauldronLogger.info(`Applying Patch: ${patch.name}`);
                installObject = { ...installObject, ...patch.patch }
            };

            let SESSION_ID = createUUID();

            cauldronLogger.debug(`Session ID: ${SESSION_ID}`);


            const CE_OBJECT = await getCEObject(installObject);

            // Check For Java Installation
            let expectedJavaLoc = path.join(grabPath(), 'jvm', CE_OBJECT.jreVersion)
            if (!fs.existsSync(expectedJavaLoc)) {
                CE_OBJECT.installQueue = [...CE_OBJECT.installQueue, ...CE_OBJECT.javaQueue];
            }

            await verifyInstallation(CE_OBJECT.installQueue);


            // Perform Post Actions
            if (CE_OBJECT.post) {
                let additionalLibs = await postProcessing(CE_OBJECT);
                CE_OBJECT.libList = [...CE_OBJECT.libList, ...additionalLibs]
            }
            let end = new Date();
            let time = end - start;
            cauldronLogger.debug(`Install Took ${time}ms`)
            resolve(CE_OBJECT);

        } catch (e) {
            reject(e);
        };
    })
}




module.exports = { startGame, installGame }