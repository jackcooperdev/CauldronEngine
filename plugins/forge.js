const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const axios = require('axios');
const osCurrent = require('os').platform();
const spawn = require('await-spawn')
const decompress = require("decompress");
const StreamZip = require('node-stream-zip');

//Imported Controllers
const { processQueue } = require('../controllers/queue');
const { getLibraries } = require('../controllers/libraries');

// Tools
const { cauldronLogger } = require('../tools/logger');
const { checkForValidFiles, downloadVersionManifests } = require('../tools/downloader');
const { grabPath } = require('../tools/compatibility');

// Global Cauldron Path
var CAULDRON_PATH = grabPath();


// Important Links
const FORGE_REPO = "https://maven.minecraftforge.net/net/minecraftforge";
const FORGE_PROMO = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const LIBRARY_PATH = "https://libraries.minecraft.net/"

// Require Files
var suffixes = require('./forge-files/suffixes.json');
var template = require('../tools/manifestTemplate.json');
var reqLegMod = require('./forge-files/requires_legacy_mod.json');
//MODIFY THIS FILE WITH CAUTION THE VERSIONS IN THIS FILE HAVE NOT BEEN TESTED OR DO NOT WORK
var unsupportedVersions = require('./forge-files/blocked_versions.json');
const { attemptToConvert } = require('../tools/manifestConverter');

// Vars
var suffixUsed = "";


// Util Functions
function getSuffixUsed() {
    return suffixUsed;
};


async function getForgeInstallerURL(version, forgeVersion) {
    var url = "";
    if (suffixes[version]) {
        for (idx in suffixes[version]) {
            url = `${FORGE_REPO}/forge/${version}-${forgeVersion}${suffixes[version][idx]}/forge-${version}-${forgeVersion}${suffixes[version][idx]}-installer.jar`;
            const validateURL = await checkInstaller(url);
            suffixUsed = suffixes[version][idx]
            if (validateURL) {
                break;
            };
        };
    } else {
        url = `${FORGE_REPO}/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
    };
    if (!url) {
        throw new Error(`Sorry but Cauldron does not support ${version} forge yet. CODE: URLNFOUND`);
    };
    var verifyInstaller = await checkInstaller(url);
    if (verifyInstaller) {
        return url;
    } else {
        throw new Error(`Sorry but Cauldron does not support ${version} forge yet. CODE: URLNFOUND`);
    };

};

function convertNameToPath(name) {
    var split = name.split(":");
    var chunkOne = split[0].split(".").join("/");
    var chunkTwo = split[1];
    var chunkThree = split[2];
    return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
};

async function checkInstaller(url) {
    var config = {
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

//Variable Injector
var injector = {
    create: (function () {
        var regexp = /\{([^{]+)}/g;
        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? '' : key;
            });
        }
    })()
};

// Grabs ForgeVersion from ForgePromo
// Attempts to find recommended version else forces latest
// Fails if in blacklist or version does not exist
async function getForgeVersion(version, type) {
    if (!type) {
        type = 'recommended';
    };
    if (unsupportedVersions.includes(version)) {
        throw new Error(`Sorry but Cauldron does not support ${version} forge yet. CODE: BLVER`);
    };
    var forgePromos = await downloadVersionManifests(FORGE_PROMO, false, false);
    var forgeVersion = forgePromos.promos[`${version}-${type}`];
    if (!forgeVersion) {
        forgeVersion = forgePromos.promos[`${version}-latest`];
        if (!forgeVersion) {
            throw new Error('Version Does Not Exist')
        }
    };
    cauldronLogger.warn("Forge is still experimental. Expect Crashes");
    return forgeVersion;
};





// Generate Forge Manifest
async function getForgeManifest(fVersion, version, versionCache) {
    return new Promise(async (resolve, reject) => {
        try {
            var grabForgeInstaller = await getForgeInstallerURL(version, fVersion);
            cauldronLogger.info("Forge Installer Path: " + grabForgeInstaller);
            var installObj = {
                origin: grabForgeInstaller,
                sha1: 'none',
                destination: path.join(CAULDRON_PATH, 'bin'),
                fileName: `forge-${version}-${fVersion}-installer.jar`
            };
            var downloadInstaller = await processQueue([installObj], 1, 'download');
            const installer = new StreamZip.async({ file: path.join(CAULDRON_PATH, 'bin', installObj.fileName) });
            const installerFiles = await installer.entries();
            const profileFileBuffer = await installer.entryData('install_profile.json');
            const profileFile = JSON.parse(profileFileBuffer);
            // There are two manifest formats It changes around 1.12.2 however there are some versions that still use the old version. We can check for the format based on if a item appears in a object.

            if (!profileFile.json) {
                cauldronLogger.info("Legacy Manifest Format");
                // Download LegacyJavaFixer (Gets Data from requires_legacy_mod.json)
                if (reqLegMod.includes(version)) {
                    var obj = {
                        origin: "https://api.mcweblauncher.tech/files/legacyjavafixer-1.0.jar",
                        sha1: 'a11b502bef19f49bfc199722b94da5f3d7b470a8',
                        destination: path.join(CAULDRON_PATH, 'mods'),
                        fileName: 'legacyjavafixer-1.0.jar'
                    };
                    var checkForMod = await processQueue([obj], 1, 'checksum');
                    while (checkForMod.length != 0) {
                        const downloadMod = await processQueue([obj], 1, 'download');
                        cauldronLogger.info("Downloaded LegacyJavaFixer Patch");
                        checkForMod = await processQueue([obj], 1, 'checksum');
                    };
                } else {
                    if (fs.existsSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))) {
                        fs.rmSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))
                    };

                };
                var versionInfo = profileFile.versionInfo;
                var manifestData = template;
                manifestData.mainClass = versionInfo.mainClass;
                manifestData.arguments.game = versionInfo.minecraftArguments.split(" ");
                var manLibs = versionInfo.libraries;

                // Process and Convert Library Array into standard format

                for (idx in manLibs) {
                    //Attempt to Extract URL
                    var url = manLibs[idx].url;
                    // If not found default to Minecraft Library Path
                    if (!url) {
                        url = LIBRARY_PATH;
                    };

                    var libName = convertNameToPath(manLibs[idx].name);
                    var libPath = `${url}${libName.chunkOne}/${libName.chunkTwo}/${libName.chunkThree}/${libName.chunkTwo}-${libName.chunkThree}.jar`;
                    // Check if Current Library is the forge version file
                    if (libName.chunkTwo == 'forge') {
                        // Create Directory for Forge Version File
                        shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/forge`, `${version}-${fVersion}`));
                        const versionFileBuffer = await installer.entryData(`forge-${version}-${fVersion}${getSuffixUsed()}-universal.jar`);
                        // Write Content to Path Declared Above
                        fs.writeFileSync(path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/forge`, `${version}-${fVersion}`, `forge-${version}-${fVersion}.jar`), versionFileBuffer);

                        // Set Manifest ID
                        manifestData.id = `${libName.chunkTwo}-${version}-${fVersion}`;
                    } else {
                        // Convert Other VALID libraries into standard format.
                        // NOTE: In this stage libraries aren't filtered based on OS this is done later

                        var rules = [];
                        var artifact = {};
                        var classifiers = {};

                        // Check For Rules
                        if (manLibs[idx].rules) {
                            rules = manLibs[idx].rules;
                        };

                        if (manLibs[idx].natives) {
                            var lNatives = manLibs[idx].natives
                            for (nIdx in lNatives) {
                                var obj = {
                                    "path": `${libName.chunkOne}/${libName.chunkTwo}/${libName.chunkThree}/${libName.chunkTwo}-${libName.chunkThree}-${lNatives[nIdx]}.jar`,
                                    "sha1": "NONE",
                                    "url": `${url}${libName.chunkOne}/${libName.chunkTwo}/${libName.chunkThree}/${libName.chunkTwo}-${libName.chunkThree}-${lNatives[nIdx]}.jar`
                                }
                                classifiers[lNatives[nIdx]] = obj
                            };
                        } else {
                            var obj = {
                                url: libPath,
                                sha1: 'NONE',
                                path: `${libName.chunkOne}/${libName.chunkTwo}/${libName.chunkThree}/${libName.chunkTwo}-${libName.chunkThree}.jar`,
                            };
                            artifact = obj;
                        };

                        // Create New Library
                        var newLib = {
                            downloads: {
                                artifact: artifact,
                                classifiers: classifiers
                            },
                            natives: manLibs[idx].natives,
                            name: manLibs[idx].name,
                            rules: rules
                        };
                        var removeUndefined = JSON.parse(JSON.stringify(newLib));
                        if (Object.keys(removeUndefined.downloads.classifiers).length == 0) {
                            delete removeUndefined.downloads.classifiers;
                        };
                        // Clean Up
                        if (removeUndefined.rules.length == 0) {
                            delete removeUndefined.rules;
                        };

                        // Add Library to Manifest Data
                        manifestData.libraries.push(removeUndefined);
                    };
                };

                //Write Version File
                shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'versions', `forge-${version}-${fVersion}`));
                fs.writeFileSync(path.join(CAULDRON_PATH, 'versions', `forge-${version}-${fVersion}`, `forge-${version}-${fVersion}.json`), JSON.stringify(profileFile));

                //Add Vanilla Data to manifest
                manifestData.assetIndex = versionCache.assetIndex;
                manifestData.assets = versionCache.assets;
                manifestData.downloads = versionCache.downloads;
                manifestData.logging = versionCache.logging;
                manifestData.javaVersion = versionCache.javaVersion;

                //Merge Libraries

                manifestData.libraries = [...manifestData.libraries, ...versionCache.libraries];


                // Close and Remove Installer File
                installer.close();
                

                //Convert To Default Format (Not Needed) and fill in blank values (prob JVM args)
                const converted = await attemptToConvert(manifestData);
                resolve(converted);
            } else {
                // New Format
                cauldronLogger.info("New Manifest Format");
                // Remove LegacyFixer if present
                if (fs.existsSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))) {
                    fs.rmSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))
                };

                const versionFileBuffer = await installer.entryData('version.json');
                const versionFile = JSON.parse(versionFileBuffer);
                //var versionFileBuffer
                // Extract Main Forge and Remove Lib if present
                var mainForge = versionFile.libraries.shift();
                var libraries = versionFile.libraries;
                if (libraries[0].name.includes("client")) {
                    libraries.shift();
                };

                //console.log(libraries[0])
                // Create new Manifest Data from Template
                var manifestData = template;

                manifestData.id = `forge-${version}-${fVersion}`;
                manifestData.mainClass = versionFile.mainClass;

                //No Need to convert library list as its already in standard format.
                manifestData.libraries = [...versionCache.libraries, ...libraries];

                if (!versionFile.minecraftArguments) {
                    manifestData.arguments.game = [...versionFile.arguments.game,...versionCache.arguments.game];
                    if (versionFile.arguments.jvm) {
                        manifestData.arguments.jvm =  [...versionCache.arguments.jvm,...versionFile.arguments.jvm];
                    } else {
                        manifestData.arguments.jvm =  [...versionCache.arguments.jvm];
                    }
                    
                } else {
                    manifestData.arguments.game = versionFile.minecraftArguments.split(" ");
                };

                //Add Vanilla Data to manifest
                manifestData.assetIndex = versionCache.assetIndex;
                manifestData.assets = versionCache.assets;
                manifestData.downloads = versionCache.downloads;
                manifestData.logging = versionCache.logging;
                manifestData.javaVersion = versionCache.javaVersion;


                shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', mainForge.downloads.artifact.path, '../'));

                if (mainForge.downloads.artifact.url != "") {
                    var obj = {
                        origin: mainForge.downloads.artifact.url,
                        sha1: mainForge.downloads.artifact.sha1,
                        destination: path.join(CAULDRON_PATH,'libraries',mainForge.downloads.artifact.path,'../'),
                        fileName: path.basename(mainForge.downloads.artifact.path)
                    };
                    var checkForMod = await processQueue([obj], 1, 'download');
                } else {
                    cauldronLogger.info("No Universal Download Link. Assuming Path");
                    var forgePath = path.join('net', 'minecraftforge', 'forge', `${version}-${fVersion}`)
                    const entries = await installer.entries();
                    var filesInMaven = new Array();
                    for (const entry of Object.values(entries)) {
                        if (entry.name.includes(forgePath.split("\\").join("/")) && !entry.isDirectory) {
                            filesInMaven.push(entry.name);
                        };
                    };
                    for (fIdx in filesInMaven) {
                        var removeMaven = filesInMaven[fIdx].split("maven")[1];
                        const mFileBuffer = await installer.entryData(filesInMaven[fIdx]);
                        fs.writeFileSync(path.join(CAULDRON_PATH, 'libraries', removeMaven), mFileBuffer);
                    };
                };
                //Convert To Default Format (Not Needed) and fill in blank values (prob JVM args)

                const converted = await attemptToConvert(manifestData);


                //NOTE: Installer not deleted as its needed in Post Processing
                // Close Installer File
                installer.close();
                resolve(converted);

            };

        } catch (err) {
            console.log(err)
            reject(err)
        }
    })
}


async function postProcessing(versionData, manifest) {
    return new Promise(async (resolve,reject) => {
        var version = versionData.version;
        var fVersion = versionData.loaderVersion;
        const installer = new StreamZip.async({ file: path.join(CAULDRON_PATH, 'bin', `forge-${versionData.version}-${versionData.loaderVersion}-installer.jar`) });
        const profileFileBuffer = await installer.entryData('install_profile.json');
        const profileFile = JSON.parse(profileFileBuffer);
        // Check if Processors Exists 
        if (profileFile.processors) {
            if (profileFile.processors.length == 0) {
                resolve(true);
            } else {
                try {
                    const versionFileBuffer = await installer.entryData('version.json');
                    const versionFile = JSON.parse(versionFileBuffer);
    
                    // Some Actions require the main forge file to be accesible via a URL. This patches the url to a localhost path.
                    var relLib = versionFile.libraries[0];
                    var localPath = `http://localhost:8778/libraries/${relLib.downloads.artifact.path}`;
                    relLib.downloads.artifact.url = localPath;
                    versionFile.libraries[0] = relLib;
    
                    // Some Actons require the forge JSON file to be accesible.
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'versions', `forge-${version}-${fVersion}`, `forge-${version}-${fVersion}.json`), JSON.stringify(versionFile));
    
                    //Aquire Libraries (These Libraries are required but do not need to be included in the launch file)
                    var nonDeclaredLibs = profileFile.libraries;
                    var downloadNonDeclaredLibs = await getLibraries(nonDeclaredLibs,osCurrent, versionData);
                    
                    // Aquire Forge Data
                    var forgeData = profileFile.data;

                    // Attempt to find MCP Version
                    var MCP_VERSION = "";
                    if (!forgeData.MCP_VERSION) {
                        MCP_VERSION = forgeData.MAPPINGS.client.split(`${version}-`)[1].split(":")[0]
                    } else {
                        MCP_VERSION = forgeData.MCP_VERSION.client.replace(/'/g, "");
                    };
                    
                    const clientLzmaBuffer = await installer.entryData('data/client.lzma');
                    fs.writeFileSync(path.join(CAULDRON_PATH,'bin','client.lzma'),clientLzmaBuffer);

                    // Generate Params
                    var params = {};
                    var shaParams = {};
                    for (fIdx in forgeData) {
                        if (fIdx == 'MCP_VERSION') {
                            params[fIdx] = MCP_VERSION;
                        } else if (fIdx == 'BINPATCH') {
                            params[fIdx] = path.join(CAULDRON_PATH,'bin','client.lzma');
                        } else if (!fIdx.includes('SHA')) {
                            var splitDir = forgeData[fIdx].client.replace(/\[|\]/g, "").split(":");
                            if (fIdx == 'MAPPINGS' || fIdx == 'MOJMAPS' || fIdx == 'MERGED_MAPPINGS') {
                                params[fIdx] = path.join(CAULDRON_PATH, 'libraries', splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2], `${splitDir[1]}-${splitDir[2]}-${splitDir[3]}`.replace("@", "."))
                            } else {
                                params[fIdx] = path.join(CAULDRON_PATH, 'libraries', splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2], `${splitDir[1]}-${splitDir[2]}-${splitDir[3]}.jar`)
                            };
                        } else {
                            shaParams[fIdx] = forgeData[fIdx].client.replace(/'/g, "");
                        }
                    };

                    // Additional Params
                    params['MAPPING_PATH'] = path.join(CAULDRON_PATH, 'libraries', 'de/oceanlabs/mcp/mcp_config', `${version}-${MCP_VERSION}`, `mcp_config-${version}-${MCP_VERSION}.zip`);
                    params['MINECRAFT_JAR'] = path.join(CAULDRON_PATH, 'versions', `forge-${version}-${fVersion}`, `forge-${version}-${fVersion}.jar`);
                    params['SIDE'] = 'client';

                    // Check Checksums to see if skipping is possible
                    var checkObjs = new Array();
                    for (sIdx in shaParams) {
                        if (sIdx == 'PATCHED_SHA') {
                            var obj = {
                                destination:path.join(params[sIdx.split("_SHA")[0]],'../'),
                                fileName:path.basename(params[sIdx.split("_SHA")[0]]),
                                sha1:shaParams[sIdx],
                                origin:'none'
                            };
                            checkObjs.push(obj);
                        };
                    };
                    var checkFiles = await processQueue(checkObjs,3,'checksum');
                    // We only care about the PATCHED File due to the fact its the only one where the checksums will match
                    if (checkFiles.length != 0) {
                        var processors = profileFile.processors;
                        cauldronLogger.info(`Forge Post Proccessing Jobs: ${processors.length}`)
                        for (pIdx in processors) {
                            var selectedProc = processors[pIdx].jar;
                            var splitName = convertNameToPath(selectedProc);
                            var fileName = `${splitName.chunkTwo}-${splitName.chunkThree}`;
                            if (selectedProc.split(":")[3]) {
                                fileName += '-'+selectedProc.split(":")[3]
                            };

                            // Extract MainClass from Manifest File
                            var lPath = path.join(CAULDRON_PATH, 'libraries', splitName.chunkOne, splitName.chunkTwo, splitName.chunkThree, `${fileName}.jar`);
                            const lFile = new StreamZip.async({file:lPath});
                            const dataBuffer = await lFile.entryData('META-INF/MANIFEST.MF');
                            const data = dataBuffer.toString();
                            var splitMani = data.toString().split("\r\n");
                            for (mIdx in splitMani) {
                                if (splitMani[mIdx].includes("Main-Class")) {
                                    mainClass = splitMani[mIdx].split(": ")[1];
                                    break;
                                }
                            };

                            // Generate class paths
                            var classPaths = new Array();
                            for (cpIdx in processors[pIdx].classpath) {
                                var firstChunk = processors[pIdx].classpath[cpIdx].split(":")[0].split(".").join("/");
                                var secondChunk = processors[pIdx].classpath[cpIdx].split(":")[1];
                                var thirdChunk = processors[pIdx].classpath[cpIdx].split(":")[2];
                                var lPathTemp = path.join(CAULDRON_PATH, 'libraries', firstChunk, secondChunk, thirdChunk, `${secondChunk}-${thirdChunk}.jar`);
                                classPaths.push(lPathTemp);
                            };
                            classPaths.push(lPath)

                            var actualArgs = processors[pIdx].args.join(" ");

                            if (!processors[pIdx].sides || processors[pIdx].sides.includes("client")) {
                                var command = `-cp ${classPaths.join(";")} ${mainClass} ${actualArgs}`;
                                //Mappings path replacement
                                command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@txt", "@zip"), "{MAPPING_PATH}");
                                command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@tsrg", "@zip"), "{MAPPING_PATH}");
                                // Inject params
                                command = injector.create(command, params);
                                cauldronLogger.info(`Forge Post Proccessing Job: ${Number(pIdx) + 1}/${processors.length} Starting`);
                                var spawnProc = await spawn(path.join(CAULDRON_PATH,'jvm',manifest.javaVersion.component,'bin','java'), command.split(" "));
                                cauldronLogger.info(`Forge Post Proccessing Job: ${Number(pIdx) + 1}/${processors.length} Done!`);
                            };
                        };
                        installer.close();
                        resolve(true)
                    } else {
                        installer.close();
                        resolve(true);
                    };
                } catch (err) {
                    installer.close();
                    console.log(err)
                    reject(err);
                }
            };

        } else {
            //shelljs.rm('-rf', path.join(installObj.destination, installObj.fileName));
            resolve(true);
        }
    })
    //console.log(firstTemp[0])
}

module.exports = { getForgeVersion, getForgeManifest, getSuffixUsed, postProcessing,checkInstaller }