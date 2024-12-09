const path = require('path');
const StreamZip = require('node-stream-zip');
const fs = require('fs');
const shelljs = require('shelljs');


const {verifyInstallation} = require("../../controllers/queue");
const {grabPath} = require("../../tools/compatibility");
const {cauldronLogger} = require("../../tools/logger");
const {getForgeInstallerURL, convertNameToPath, getSuffixUsed} = require("./utils");

// Important Links
const FORGE_PROMO = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const LIBRARY_PATH = "https://libraries.minecraft.net/"


//Files
let reqLegMod = require('./files/requires_legacy_mod.json');
let template = require('../../files/manifestTemplate.json');
const {attemptToConvert} = require('../../tools/manifestConverter');

async function getManifest(fVersion, version, versionCache) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            // Acquire Installer URL (online or from cache)
            let grabForgeInstaller = await getForgeInstallerURL(version, fVersion);
            cauldronLogger.info("Forge Installer Path: " + grabForgeInstaller);

            // Build Installer Download File 
            let installObj = {
                origin: grabForgeInstaller,
                sha1: 'NONE',
                destination: path.join(CAULDRON_PATH, 'forge-installers'),
                fileName: `forge-${version}-${fVersion}-installer.jar`
            };

            // Download / Skip Downloading Installer
            await verifyInstallation([installObj]);


            // Extract File and acquire install_profile.json
            const installer = new StreamZip.async({file: path.join(CAULDRON_PATH, 'forge-installers', installObj.fileName)});
            await installer.entries();
            const profileFileBuffer = await installer.entryData('install_profile.json');
            const profileFile = JSON.parse(profileFileBuffer.toString());
            let manifestData;
            // Determine Manifest Format
            if (!profileFile.json) {
                cauldronLogger.info("Manifest Format: Legacy");
                manifestData = await handleLegacyFormat(fVersion, version, versionCache, profileFile, installer);
            } else {
                cauldronLogger.info("Manifest Format: Normal");
                manifestData = await handleRegFormat(fVersion, version, versionCache, profileFile, installer);
            }
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
            await installer.close();


            //Convert To Default Format and fill in blank values (prob JVM args)
            const converted = await attemptToConvert(manifestData);

            resolve(converted);

        } catch (error) {
            reject(error);
        }
    });
}

// Handle Regular Manifests (~1.12.2 and above)

async function handleRegFormat(fVersion, version, versionCache, profileFile, installer) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            // Remove LegacyFixer if present
            if (fs.existsSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))) {
                fs.rmSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))
            }

            const versionFileBuffer = await installer.entryData('version.json');
            const versionFile = JSON.parse(versionFileBuffer);

            // Extract Main Forge and Remove Lib if present
            let mainForge = versionFile.libraries.shift();
            let libraries = versionFile.libraries;
            if (libraries[0].name.includes("client")) {
                libraries.shift();
            }

            // Create new Manifest Data from Template
            let manifestData = template;

            // Set ID and Main class
            manifestData.id = `forge-${version}-${fVersion}`;
            manifestData.mainClass = versionFile.mainClass;


            let vanillaLibraries = versionCache.libraries;
            let handledLibraries = [];

            for (let idx in libraries) {
                let splitName = libraries[idx].name.split(":")
                splitName.pop()
                let convertedName = splitName.join(":");
                let obj = versionCache.libraries.find((o, i) => {
                    if (!handledLibraries.includes(convertedName)) {
                        let splitOName = o.name.split(":");
                        splitOName.pop();
                        if (splitOName.join(":") === convertedName && !handledLibraries.includes(convertedName)) {


                            handledLibraries.push(convertedName);
                            versionCache.libraries.splice(i, 1);

                        }
                    }


                });


            }

            //No Need to convert library list as its already in standard format.
            manifestData.libraries = [...versionCache.libraries, ...libraries];
            /**
             * @param versionFile.minecraftArguments
             */
            if (!versionFile.minecraftArguments) {
                manifestData.arguments.game = [...versionFile.arguments.game, ...versionCache.arguments.game];
                if (versionFile.arguments.jvm) {
                    manifestData.arguments.jvm = [...versionCache.arguments.jvm, ...versionFile.arguments.jvm];
                } else {
                    manifestData.arguments.jvm = [...versionCache.arguments.jvm];
                }

            } else {
                manifestData.arguments.game = versionFile.minecraftArguments.split(" ");
            }

            //Add Vanilla Data to manifest
            manifestData.assetIndex = versionCache.assetIndex;
            manifestData.assets = versionCache.assets;
            manifestData.downloads = versionCache.downloads;
            manifestData.logging = versionCache.logging;
            manifestData.javaVersion = versionCache.javaVersion;


            shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', mainForge.downloads.artifact.path, '../'));

            // Check for universal download link. If none extract from maven
            if (mainForge.downloads.artifact.url !== "") {
                let obj = {
                    origin: mainForge.downloads.artifact.url,
                    sha1: mainForge.downloads.artifact.sha1,
                    destination: path.join(CAULDRON_PATH, 'libraries', mainForge.downloads.artifact.path, '../'),
                    fileName: path.basename(mainForge.downloads.artifact.path)
                };

                await verifyInstallation([obj]);
            } else {
                cauldronLogger.info("No Universal Download Link. Assuming Path");
                let forgePath = path.join('net', 'minecraftforge', 'forge', `${version}-${fVersion}`)
                const entries = await installer.entries();
                let filesInMaven = [];
                for (const entry of Object.values(entries)) {
                    if (entry.name.includes(forgePath.split("\\").join("/")) && !entry.isDirectory) {
                        filesInMaven.push(entry.name);
                    }
                }
                for (let fIdx in filesInMaven) {
                    let removeMaven = filesInMaven[fIdx].split("maven")[1];
                    const mFileBuffer = await installer.entryData(filesInMaven[fIdx]);
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'libraries', removeMaven), mFileBuffer);
                }
            }

            //Convert To Default Format and fill in blank values (prob JVM args)

            const converted = await attemptToConvert(manifestData);

            // Close Installer File
            installer.close();
            resolve(converted)
        } catch (error) {

            reject(error);
        }
    })
}


// Handle Legacy Manifests (~1.12.2 and below)
async function handleLegacyFormat(fVersion, version, versionCache, profileFile, installer) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {

            // Acquire Java Fixer if version needs it
            if (reqLegMod.includes(version)) {
                let obj = [{
                    origin: "https://files.cauldronmc.com/other/legacyjavafixer-1.0.jar",
                    sha1: 'a11b502bef19f49bfc199722b94da5f3d7b470a8',
                    destination: path.join(CAULDRON_PATH, 'mods'),
                    fileName: 'legacyjavafixer-1.0.jar'
                }];
                await verifyInstallation(obj);
            } else {
                if (fs.existsSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))) {
                    fs.rmSync(path.join(CAULDRON_PATH, 'mods', 'legacyjavafixer-1.0.jar'))
                }
            }

            // Replace versionInfo Variable
            let versionInfo = profileFile.versionInfo;

            // Get Default Template
            let manifestData = template;

            // Replace Game Arguments and Main Class
            manifestData.mainClass = versionInfo.mainClass;
            manifestData.arguments.game = versionInfo.minecraftArguments.split(" ");

            // Get Forge Libraries
            let forgeLibs = versionInfo.libraries;

            // Process and convert forge libraries into standard format
            for (let idx in forgeLibs) {
                // Attempt to extract URL from Library
                let url = forgeLibs[idx].url;
                // If URL is not extracted use default Minecraft Library Path
                if (!url) {
                    url = LIBRARY_PATH;
                }
                // Convert Library Name To Path and URL
                let pathChunks = convertNameToPath(forgeLibs[idx].name);
                let libraryPath = `${pathChunks.chunkOne}/${pathChunks.chunkTwo}/${pathChunks.chunkThree}/${pathChunks.chunkTwo}-${pathChunks.chunkThree}.jar`;
                let libraryURL = `${url}${libraryPath}`;

                // Check if Current Forge Library is the forge version file
                if (pathChunks.chunkTwo === 'forge') {
                    // Create Directory to Forge Version File
                    shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/forge`, `${version}-${fVersion}`));
                    const versionFileBuffer = await installer.entryData(`forge-${version}-${fVersion}${getSuffixUsed()}-universal.jar`);
                    //Write Buffer to File
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/forge`, `${version}-${fVersion}`, `forge-${version}-${fVersion}.jar`), versionFileBuffer);
                    // Set Manifest ID
                    manifestData.id = `${pathChunks.chunkTwo}-${version}-${fVersion}`;
                } else if (pathChunks.chunkTwo === 'minecraftforge') {
                    // ~1.6 Compatability
                    // Create Directory to Forge Version File
                    shelljs.mkdir('-p', path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/minecraftforge`, `${fVersion}`));
                    const versionFileBuffer = await installer.entryData(`minecraftforge-universal-${version}-${fVersion}${getSuffixUsed()}.jar`);
                    // //Write Buffer to File
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'libraries', `net/minecraftforge/minecraftforge`, `${fVersion}`, `minecraftforge-${version}-${fVersion}.jar`), versionFileBuffer);
                    // // Set Manifest ID
                    manifestData.id = `${pathChunks.chunkTwo}-${fVersion}`;
                } else {
                    // All Other Libraries
                    // Convert Other VALID libraries into standard format.
                    // NOTE: In this stage libraries aren't filtered based on OS this is done later

                    let rules = [];
                    let artifact = {};
                    let classifiers = {};

                    // Check For Rules
                    if (forgeLibs[idx].rules) {
                        rules = forgeLibs[idx].rules;
                    }

                    // Check For Natives

                    if (forgeLibs[idx].natives) {
                        let lNatives = forgeLibs[idx].natives
                        for (let nIdx in lNatives) {
                            classifiers[lNatives[nIdx]] = {
                                "path": `${pathChunks.chunkOne}/${pathChunks.chunkTwo}/${pathChunks.chunkThree}/${pathChunks.chunkTwo}-${pathChunks.chunkThree}-${lNatives[nIdx]}.jar`,
                                "sha1": "NONE",
                                "url": `${url}${pathChunks.chunkOne}/${pathChunks.chunkTwo}/${pathChunks.chunkThree}/${pathChunks.chunkTwo}-${pathChunks.chunkThree}-${lNatives[nIdx]}.jar`
                            }
                        }
                    } else {
                        artifact = {
                            url: libraryURL,
                            sha1: 'NONE',
                            path: `${pathChunks.chunkOne}/${pathChunks.chunkTwo}/${pathChunks.chunkThree}/${pathChunks.chunkTwo}-${pathChunks.chunkThree}.jar`,
                        };
                    }

                    //Create New Library
                    let newLib = {
                        downloads: {
                            artifact: artifact,
                            classifiers: classifiers
                        },
                        natives: forgeLibs[idx].natives,
                        name: forgeLibs[idx].name,
                        rules: rules
                    };
                    let removeUndefined = JSON.parse(JSON.stringify(newLib));
                    if (Object.keys(removeUndefined.downloads.classifiers).length === 0) {
                        delete removeUndefined.downloads.classifiers;
                    }
                    // Clean Up
                    if (removeUndefined.rules.length === 0) {
                        delete removeUndefined.rules;
                    }

                    // Add Library to Manifest Data
                    manifestData.libraries.push(removeUndefined);

                }

            }
            resolve(manifestData);
        } catch (error) {
            reject(error);
        }
    });
}


function getData() {
    return FORGE_PROMO;
}


module.exports = {getManifest, getData};