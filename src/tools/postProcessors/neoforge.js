// noinspection JSUnusedGlobalSymbols

const StreamZip = require("node-stream-zip");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const { getOperatingSystem, grabPath } = require("../compatibility.js");
const { getLibraries } = require("../../controllers/libraries.js");
const { validate } = require("../fileTools.js");
const { cauldronLogger } = require("../logger.js");

const spawn = require("await-spawn");
const osCurrent = os.platform();
function convertNameToPath(name) {
    let split = name.split(":");
    let chunkOne = split[0].split(".").join("/");
    let chunkTwo = split[1];
    let chunkThree = split[2];
    return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
}
function hasExtractFilesTask(entry) {
    if (!Array.isArray(entry.args)) return false;
    const taskIndex = entry.args.indexOf('--task');
    if (taskIndex === -1) return false;
    return entry.args[taskIndex + 1] === 'EXTRACT_FILES';
}
function addManifestToJar(jarPath, javaDir) {
    const jarTool = path.join(javaDir, "jar");
    const manifestContent = "Manifest-Version: 1.0\nAutomatic-Module-Name: minecraft\n\n";
    const manifestPath = path.join(grabPath(), 'config', 'packwiz', 'cauldron_manifest.mf')
    fs.writeFileSync(manifestPath, manifestContent);
    try {
        if (osCurrent === "linux" || osCurrent === "darwin") {
            execSync(`chmod +x "${jarTool}"`);
        }
        const result = execSync(`"${jarTool}" --update --file="${jarPath}" --manifest="${manifestPath}"`, { stdio: 'pipe' });
    } catch (e) {
        console.error('addManifestToJar ERROR:', e.message);
        console.error('stderr:', e.stderr?.toString());
    } finally {
        if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    }
}
async function postProcessing(manifests, libs, version, side = 'client', cPath) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        let mainClass;
        try {
            let { version, loaderVersion } = manifests.versionData;
            let libPath = path.join(CAULDRON_PATH, "libraries");
            let jarLoc = path.join(CAULDRON_PATH, 'versions', `neoforge-${version}-${loaderVersion}`, `neoforge-${version}-${loaderVersion}.jar`)
            if (cPath) {
                libPath = cPath;
                jarLoc = path.join(libPath, '../', `minecraft_server.${version}.jar`)
            }

            let profileFile = manifests.postData;

            if (profileFile.processors) {
                if (profileFile.processors.length === 0) {
                    resolve(libs);
                } else {
                    const filtered = profileFile.processors.filter(entry => !hasExtractFilesTask(entry));
                    profileFile.processors = filtered;
                    let nonDeclaredLibs = profileFile.libraries;
                    await getLibraries(nonDeclaredLibs, manifests.versionData, manifests.spec.id, `${manifests.spec.id}-post-${side}`, libPath);

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

                    // Generate Params
                    let params = {};
                    let shaParams = {};
                    for (let fIdx in forgeData) {
                        if (fIdx === "MCP_VERSION") {
                            params[fIdx] = MCP_VERSION;
                        } else if (fIdx === "BINPATCH") {
                            params[fIdx] = path.join(libPath, `/net/clients/neoforge-${manifests.version}-${manifests.loaderVersion}`, `${manifests.postData.data.BINPATCH[side].replace('/data/','')}`);
                            //params[fIdx] = path.join(CAULDRON_PATH, "versions", `neoforge-${manifests.version}-${manifests.loaderVersion}`, "client.lzma");
                        } else if (!fIdx.includes("SHA")) {
                            let splitDir = forgeData[fIdx][side]
                                .replace(/[\[\]]/g, "")
                                .split(":");
                            if (fIdx === "MAPPINGS") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}`
                                );
                            } else if (fIdx === "MOJMAPS") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}`
                                );
                            } else if (fIdx === "MERGED_MAPPINGS") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}-merged`
                                );
                            } else if (fIdx === "MC_SRG") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}-srg.jar`
                                );
                            } else if (fIdx === "MC_SLIM") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}-slim.jar`
                                );
                            } else if (fIdx === "MC_EXTRA") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}-extra.jar`
                                );
                            } else if (fIdx === "MC_UNPACKED") {
                                params[fIdx] = path.join(
                                    libPath,
                                    splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                    `${splitDir[1]}-${splitDir[2]}.jar`
                                );
                            } else if (fIdx === "PATCHED") {
                                const classifier = splitDir[3]; // e.g. "client" or undefined
                                if (classifier) {
                                    params[fIdx] = path.join(
                                        libPath,
                                        splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                        `${splitDir[1]}-${splitDir[2]}-${classifier}.jar`
                                    );
                                } else {
                                    params[fIdx] = path.join(
                                        libPath,
                                        splitDir[0].replace(/\./g, "/"), splitDir[1], splitDir[2],
                                        `${splitDir[1]}-${splitDir[2]}.jar`
                                    );
                                }
                            }
                        } else {
                            shaParams[fIdx] = forgeData[fIdx].client.replace(/'/g, "");
                        }
                    }

                    // Additional Params
                    params["MAPPING_PATH"] = path.join(libPath, "net/neoforged/neoform", `${MCP_VERSION}`, `neoform-${MCP_VERSION}.zip`,);
                    params["MINECRAFT_JAR"] = jarLoc
                    params["SIDE"] = side;
                    params['ROOT'] = path.join(libPath, '../')

                    const patchedClientPath = params["PATCHED"];
                    console.log(params)
                    console.log(manifests.postData.data.BINPATCH)
                    //process.exit(0)
                    const javaDir = getOperatingSystem() === "osx"
                        ? path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "jre.bundle/Contents/Home/bin")
                        : path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "bin");


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
                    let checkFiles = [];
                    if (checkObjs.length > 0) {
                        checkFiles = await validate(checkObjs[0]);
                        if (checkFiles === true) {
                            checkFiles = [];
                        } else {
                            checkFiles = [checkFiles];
                        }
                    }
                    let override = !fs.existsSync(patchedClientPath);
                    let processors = profileFile.processors;
                    cauldronLogger.info("Starting NeoForge Post Processing Jobs");
                    for (let pIdx in processors) {
                        let currentProcessor = processors[pIdx];
                        let selectedProc = currentProcessor.jar;
                        let splitName = convertNameToPath(selectedProc);
                        let fileName = `${splitName.chunkTwo}-${splitName.chunkThree}`;
                        if (selectedProc.split(":")[3]) {
                            fileName += "-" + selectedProc.split(":")[3];
                        }


                        // Extract MainClass From Manifest File
                        let lPath = path.join(libPath, splitName.chunkOne, splitName.chunkTwo, splitName.chunkThree, `${fileName}.jar`,);
                        const lFile = new StreamZip.async({ file: lPath });
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
                            let thirdChunk = processors[pIdx].classpath[cpIdx].split(":")[2].replace("@jar", "");
                            let lPathTemp = path.join(libPath, firstChunk, secondChunk, thirdChunk, `${secondChunk}-${thirdChunk}.jar`,);
                            classPaths.push(lPathTemp);
                        }
                        classPaths.push(lPath);
                        let actualArgs = processors[pIdx].args.join(" ");
                        if (!processors[pIdx].sides || processors[pIdx].sides.includes(side)) {
                            let classPathSep;
                            let osCurrent = getOperatingSystem();
                            if (osCurrent === "windows") {
                                classPathSep = ";";
                            } else {
                                classPathSep = ":";
                            }
                            let command = `-cp ${classPaths.join(classPathSep)} ${mainClass} ${actualArgs}`;
                            // Mappings path replacement
                            if (forgeData.MAPPINGS) {
                                command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@txt", "@zip"), "{MAPPING_PATH}",);
                                command = command.replace(forgeData.MAPPINGS.client.replace(":mappings@tsrg", "@zip"), "{MAPPING_PATH}",);
                            }

                            // Inject params
                            command = injector.create(command, params);
                            let javaPath = path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "bin", "java");

                            if (getOperatingSystem() === "osx") {
                                javaPath = path.join(CAULDRON_PATH, "jvm", manifests.jvmComp, "jre.bundle", "Contents/Home/bin", "java");
                            }

                            if (checkFiles.length !== 0 || override) {
                                try {
                                    console.log(`${javaPath} ${command}`)
                                    cauldronLogger.debug(`${javaPath} ${command}`)
                                    const result = await spawn(javaPath, command.split(" "));
                                    cauldronLogger.debug(result.toString());
                                } catch (e) {
                                    cauldronLogger.debug('STDOUT:', e.stdout?.toString());
                                    cauldronLogger.debug('STDERR:', e.stderr?.toString());
                                    reject(e);
                                    return;
                                }
                            } else {
                                // Processors skipped - add manifest to existing client jar and add to libs
                                if (patchedClientPath && fs.existsSync(patchedClientPath)) {
                                    addManifestToJar(patchedClientPath, javaDir);
                                }
                                //libs.push(patchedClientPath);
                                cauldronLogger.info("Skipping NeoForge Post Processing Jobs (ABC)");
                                resolve(libs);
                                return;
                            }
                        }
                    }

                    // Processors ran - add manifest to the freshly patched client jar and add to libs
                    if (patchedClientPath && fs.existsSync(patchedClientPath)) {
                        addManifestToJar(patchedClientPath, javaDir);
                    }
                    //libs.push(patchedClientPath);

                    cauldronLogger.info("Finished NeoForge Post Processing Jobs");
                    resolve(libs);
                }
            } else {
                resolve(libs);
            }
        } catch (err) {
            console.log('post fail');
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
module.exports = { postProcessing };