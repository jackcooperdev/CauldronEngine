// noinspection JSUnusedGlobalSymbols

const StreamZip = require("node-stream-zip");
const fs = require("fs");
const path = require("path");
const { getOperatingSystem, grabPath } = require("../compatibility.js");
const { getLibraries } = require("../../controllers/libraries.js");
const { validate } = require("../fileTools.js");
const { cauldronLogger } = require("../logger.js");

const spawn = require("await-spawn");

function convertNameToPath(name) {
    let split = name.split(":");
    let chunkOne = split[0].split(".").join("/");
    let chunkTwo = split[1];
    let chunkThree = split[2];
    return {chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree};
}

async function postProcessing(manifests, libs) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        let mainClass;
        try {
            let {version, loaderVersion} = manifests.versionData;

            // const profileFileInit = await installer.entryData("install_profile.json");
            const profileFile = manifests.postData;

            // Check if Processors Exists
            /**
             * @param profileFile.processors
             */
            if (profileFile.processors) {
                if (profileFile.processors.length === 0) {
                    resolve(libs);
                } else {
                    //const versionFile = manifests.spec;

                    // let relLib = versionFile.libraries[0];
                    // // Some actions require the websocket forge file to be accessible via a URL. This patches the url to a localhost path.
                    // // This defaults to CauldronAgents port number (8778) and is on the path /libraries.
                    // // TESTING ALTERNATIVE SOLUTIONS
                    // //  REQUIRES an INVESTIGATION INTO WHAT VERSIONS NEED IT
                    // //relLib.downloads.artifact.url = path.join(CAULDRON_PATH, 'libraries', relLib.downloads.artifact.path);
                    // relLib.downloads.artifact.url = `http://localhost:8778/libraries/${relLib.downloads.artifact.path}`;
                    // versionFile.libraries[0] = relLib;

                    // Some Actions require the forge JSON file to be accessible.
                    //fs.writeFileSync(path.join(CAULDRON_PATH, "versions", `forge-${version}-${loaderVersion}`, `forge-${version}-${loaderVersion}.json`,), JSON.stringify(versionFile),);

                    //Acquire Libraries (These Libraries are required but do not need to be included in the launch file)
                    let nonDeclaredLibs = profileFile.libraries;
                    await getLibraries(nonDeclaredLibs, manifests.versionData, manifests.spec.id, `${manifests.spec.id}-post`,);

                    // Acquire Forge Data
                    /**
                     * @param forgeData.MCP_VERSION
                     * @param forgeData.MAPPINGS
                     */
                    let forgeData = profileFile.data;

                    // Attempt to find MCP Version
                    let MCP_VERSION = "";
                    if (!forgeData.MCP_VERSION && forgeData.MAPPINGS) {
                        MCP_VERSION = forgeData.MAPPINGS.client
                            .split(`${version}-`)[1]
                            .split(":")[0];
                    } else if (forgeData.MCP_VERSION) {
                        MCP_VERSION = forgeData.MCP_VERSION.client.replace(/'/g, "");
                    }

                    // const clientLzmaBuffer =
                    //     await installer.entryData("data/client.lzma");
                    // fs.writeFileSync(path.join(CAULDRON_PATH, "versions", `forge-${version}-${loaderVersion}`, "client.lzma",),
                    //     clientLzmaBuffer,
                    // );

                    // Generate Params
                    let params = {};
                    let shaParams = {};
                    for (let fIdx in forgeData) {
                        if (fIdx === "MCP_VERSION") {
                            params[fIdx] = MCP_VERSION;
                        } else if (fIdx === "BINPATCH") {
                            params[fIdx] = path.join(CAULDRON_PATH, "versions", `forge-${manifests.version}-${manifests.loaderVersion}`, "client.lzma");
                        } else if (!fIdx.includes("SHA")) {
                            let splitDir = forgeData[fIdx].client
                                .replace(/[\[\]]/g, "")
                                .split(":");
                            if (fIdx === "MAPPINGS" || fIdx === "MOJMAPS" || fIdx === "MERGED_MAPPINGS") {
                                params[fIdx] = path.join(CAULDRON_PATH, "libraries", splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2], `${splitDir[1]}-${splitDir[2]}-${splitDir[3]}`.replace("@", ".",),);
                            } else {
                                params[fIdx] = path.join(CAULDRON_PATH, "libraries", splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2], `${splitDir[1]}-${splitDir[2]}-${splitDir[3]}.jar`,);
                            }
                        } else {
                            shaParams[fIdx] = forgeData[fIdx].client.replace(/'/g, "");
                        }
                    }

                    // Additional Params
                    params["MAPPING_PATH"] = path.join(CAULDRON_PATH, "libraries", "de/oceanlabs/mcp/mcp_config", `${version}-${MCP_VERSION}`, `mcp_config-${version}-${MCP_VERSION}.zip`,);
                    params["MINECRAFT_JAR"] = path.join(CAULDRON_PATH, "versions", `forge-${version}-${loaderVersion}`, `forge-${version}-${loaderVersion}.jar`,);
                    params["SIDE"] = "client";

                    // Check Checksums to see if skipping is possible
                    let checkObjs = [];
                    for (let sIdx in shaParams) {
                        if (sIdx === "PATCHED_SHA") {
                            let obj = {
                                destination: path.join(params[sIdx.split("_SHA")[0]], "../"),
                                fileName: path.basename(params[sIdx.split("_SHA")[0]]),
                                sha1: shaParams[sIdx],
                                origin: "none",
                            };
                            checkObjs.push(obj);
                        }
                    }
                    let checkFiles = await validate(checkObjs[0]);
                    if (checkFiles === true) {
                        checkFiles = [];
                    } else {
                        checkFiles = [checkFiles];
                    }

                    // We only care about the PATCHED File due to the fact it's the only one where the checksums will match
                    let override = false;
                    if (checkFiles.length !== 0 || override) {
                        let processors = profileFile.processors;
                        cauldronLogger.info("Starting Forge Post Processing Jobs");
                        for (let pIdx in processors) {
                            let currentProcessor = processors[pIdx];
                            /**
                             * @param currentProcessor
                             * @param currentProcessor.jar
                             * @param currentProcessor.sides
                             */
                            let selectedProc = currentProcessor.jar;
                            let splitName = convertNameToPath(selectedProc);
                            let fileName = `${splitName.chunkTwo}-${splitName.chunkThree}`;
                            if (selectedProc.split(":")[3]) {
                                fileName += "-" + selectedProc.split(":")[3];
                            }

                            // Extract MainClass From Manifest File
                            let lPath = path.join(CAULDRON_PATH, "libraries", splitName.chunkOne, splitName.chunkTwo, splitName.chunkThree, `${fileName}.jar`,);
                            const lFile = new StreamZip.async({file: lPath});
                            const dataBuffer = await lFile.entryData("META-INF/MANIFEST.MF");
                            const data = dataBuffer.toString();
                            let splitMani = data.toString().split("\r\n");
                            for (let mIdx in splitMani) {
                                if (splitMani[mIdx].includes("Main-Class")) {
                                    mainClass = splitMani[mIdx].split(": ")[1];
                                    break;
                                }
                            }

                            // Generate Class Paths
                            let classPaths = [];
                            for (let cpIdx in processors[pIdx].classpath) {
                                let firstChunk = processors[pIdx].classpath[cpIdx]
                                    .split(":")[0]
                                    .split(".")
                                    .join("/");
                                let secondChunk = processors[pIdx].classpath[cpIdx].split(":")[1];
                                let thirdChunk = processors[pIdx].classpath[cpIdx].split(":")[2];
                                let lPathTemp = path.join(CAULDRON_PATH, "libraries", firstChunk, secondChunk, thirdChunk, `${secondChunk}-${thirdChunk}.jar`,);
                                classPaths.push(lPathTemp);
                            }
                            classPaths.push(lPath);
                            let actualArgs = processors[pIdx].args.join(" ");
                            if (!processors[pIdx].sides || processors[pIdx].sides.includes("client")) {
                                let classPathSep;
                                let osCurrent = getOperatingSystem();
                                if (osCurrent === "windows") {
                                    classPathSep = ";";
                                } else {
                                    classPathSep = ":";
                                }
                                let command = `-cp ${classPaths.join(classPathSep)} ${mainClass} ${actualArgs}`;
                                //Mappings path replacement
                                if (forgeData.MAPPINGS) {
                                    command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@txt", "@zip"), "{MAPPING_PATH}",);
                                    command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@tsrg", "@zip"), "{MAPPING_PATH}",);
                                }
                                // Inject params
                                command = injector.create(command, params);
                                let javaPath = path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "bin", "java",)

                                if (getOperatingSystem() === "osx") {
                                    javaPath = path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "jre.bundle","Contents/Home/bin", "java");
                                }
                                await spawn(javaPath, command.split(" "));

                                let knownClientPatchers = ["net.minecraftforge.binarypatcher.ConsoleTool"]
                                if (knownClientPatchers.includes(mainClass)) {
                                    let clientPath = path.join(CAULDRON_PATH, 'libraries', 'net/minecraftforge/forge', `${manifests.version}-${manifests.loaderVersion}`, `forge-${manifests.version}-${manifests.loaderVersion}-client.jar`);
                                    let currentVersionFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "versions", `forge-${manifests.version}-${manifests.loaderVersion}`, `forge-${manifests.version}-${manifests.loaderVersion}.json`)).toString());
                                    let newLib = {
                                        "name": `net.minecraftforge:forge:${manifests.version}-${manifests.loaderVersion}:client`,
                                        "downloads": {
                                            "artifact": {
                                                "path": `net/minecraftforge/forge/${manifests.version}-${manifests.loaderVersion}/forge-${manifests.version}-${manifests.loaderVersion}-client.jar`,
                                                "url": "",
                                                "sha1": "NONE",
                                                "size": 0
                                            }
                                        }
                                    };
                                    currentVersionFile.libraries.push(newLib);
                                    fs.writeFileSync(path.join(CAULDRON_PATH, "versions", `forge-${manifests.version}-${manifests.loaderVersion}`, `forge-${manifests.version}-${manifests.loaderVersion}.json`), JSON.stringify(currentVersionFile, null, 2));
                                    libs.push(clientPath)
                                }

                            }
                        }
                        cauldronLogger.info("Finished Forge Post Processing Jobs");
                        resolve(libs);
                    } else {
                        cauldronLogger.info("Skipping Forge Post Processing Jobs");
                        resolve(libs);
                    }
                }
            } else {
                resolve(libs);
            }
        } catch (err) {
            console.log(err);
            reject(err);
        }
    });
}

//Variable Injector
let injector = {
    create: (function () {
        let regexp = /\{([^{]+)}/g;
        return function (str, o) {
            return str.replace(regexp, function (ignore, key) {
                return (key = o[key]) == null ? "" : key;
            });
        };
    })(),
};
module.exports =  {postProcessing};
