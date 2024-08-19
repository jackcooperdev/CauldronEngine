const StreamZip = require('node-stream-zip');
const fs = require('fs')
const path = require('path')

const { grabPath } = require("../../tools/compatibility");
const { getLibraries } = require('../../controllers/libraries');
const { validate } = require('../../tools/fileTools');
const { cauldronLogger } = require('../../tools/logger');
const { convertNameToPath } = require('./utils');
const spawn = require('await-spawn')


async function postProcessing(manifests) {
    return new Promise(async (resolve, reject) => {
        var CAULDRON_PATH = grabPath();
        try {
            var { version, loaderVersion } = manifests.versionData;
            const installer = new StreamZip.async({ file: path.join(CAULDRON_PATH, 'forge-installers', `forge-${version}-${loaderVersion}-installer.jar`) });
            const profileFileBuffer = await installer.entryData('install_profile.json');
            const profileFile = JSON.parse(profileFileBuffer);

            // Check if Processors Exists
            if (profileFile.processors) {
                if (profileFile.processors.length == 0) {
                    resolve(true);
                } else {
                    const versionFileBuffer = await installer.entryData('version.json');
                    const versionFile = JSON.parse(versionFileBuffer);

                    var relLib = versionFile.libraries[0];
                    // Some actions require the main forge file to be accesible via a URL. This patches the url to a localhost path.
                    // This defaults to CauldronAgents port number (8778) and is on the path /libraries.
                    // TESTING ALTERNATIVE SOLUTIONS
                    // REQUIRES INVESTIGATION INTO WHAT VERSIONS NEED IT
                    relLib.downloads.artifact.url = path.join(CAULDRON_PATH, 'libraries', relLib.downloads.artifact.path);
                    //versionFile.libraries[0] = relLib;

                    // Some Actons require the forge JSON file to be accesible.
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'versions', `forge-${version}-${loaderVersion}`, `forge-${version}-${loaderVersion}.json`), JSON.stringify(versionFile));


                    //Aquire Libraries (These Libraries are required but do not need to be included in the launch file)
                    var nonDeclaredLibs = profileFile.libraries;
                    var downloadNonDeclaredLibs = await getLibraries(nonDeclaredLibs, manifests.versionData, manifests.spec.id);

                    // Aquire Forge Data
                    var forgeData = profileFile.data;


                    // Attempt to find MCP Version
                    var MCP_VERSION = "";
                    if (!forgeData.MCP_VERSION && forgeData.MAPPINGS) {
                        ////console.log(forgeData)
                        MCP_VERSION = forgeData.MAPPINGS.client.split(`${version}-`)[1].split(":")[0]
                    } else if (forgeData.MCP_VERSION){
                        MCP_VERSION = forgeData.MCP_VERSION.client.replace(/'/g, "");
                    };

                    const clientLzmaBuffer = await installer.entryData('data/client.lzma');
                    fs.writeFileSync(path.join(CAULDRON_PATH, 'versions', `forge-${version}-${loaderVersion}`, 'client.lzma'), clientLzmaBuffer);

                    // Generate Params
                    var params = {};
                    var shaParams = {};
                    for (fIdx in forgeData) {
                        if (fIdx == 'MCP_VERSION') {
                            params[fIdx] = MCP_VERSION;
                        } else if (fIdx == 'BINPATCH') {
                            params[fIdx] = path.join(CAULDRON_PATH, 'versions', `forge-${version}-${loaderVersion}`, 'client.lzma');
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
                    params['MINECRAFT_JAR'] = path.join(CAULDRON_PATH, 'versions', `forge-${version}-${loaderVersion}`, `forge-${version}-${loaderVersion}.jar`);
                    params['SIDE'] = 'client';

                    // Check Checksums to see if skipping is possible
                    var checkObjs = new Array();
                    for (sIdx in shaParams) {
                        if (sIdx == 'PATCHED_SHA') {
                            var obj = {
                                destination: path.join(params[sIdx.split("_SHA")[0]], '../'),
                                fileName: path.basename(params[sIdx.split("_SHA")[0]]),
                                sha1: shaParams[sIdx],
                                origin: 'none'
                            };
                            checkObjs.push(obj);
                        };
                    };
                    var checkFiles = await validate(checkObjs[0]);
                    if (checkFiles == true) {
                        checkFiles = []
                    } else {
                        checkFiles = [checkFiles]
                    };

                    // We only care about the PATCHED File due to the fact its the only one where the checksums will match

                    if (checkFiles.length != 0) {
                        var processors = profileFile.processors;
                        cauldronLogger.info(`Forge Post Proccessing Jobs: ${processors.length}`);

                        for (pIdx in processors) {
                            var selectedProc = processors[pIdx].jar;
                            var splitName = convertNameToPath(selectedProc);
                            var fileName = `${splitName.chunkTwo}-${splitName.chunkThree}`;
                            if (selectedProc.split(":")[3]) {
                                fileName += '-'+selectedProc.split(":")[3]
                            };

                            // Extract MainClass From Manifest File
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

                            // Generate Class Paths
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
                                if (forgeData.MAPPINGS) {
                                    command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@txt", "@zip"), "{MAPPING_PATH}");
                                    command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@tsrg", "@zip"), "{MAPPING_PATH}");
                                };
                                // Inject params
                                command = injector.create(command, params);
                                cauldronLogger.info(`Forge Post Proccessing Job: ${Number(pIdx) + 1}/${processors.length} Starting`);
                                var spawnProc = await spawn(path.join(CAULDRON_PATH,'jvm',manifests.jvmComp,'bin','java'), command.split(" "));
                                //console.log(path.join(CAULDRON_PATH,'jvm',manifests.jvmComp,'bin','java') + " "+command)
                                cauldronLogger.info(`Forge Post Proccessing Job: ${Number(pIdx) + 1}/${processors.length} Done!`);
                            };
                        };
                        installer.close();
                        resolve(true);
                    } else {
                        installer.close();
                        resolve(true);
                    }

                }
            } else {
                resolve(true);
            };
        } catch (err) {
            //console.log(err)
        };
    })
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
module.exports = { postProcessing }