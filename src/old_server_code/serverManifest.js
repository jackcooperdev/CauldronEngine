async function getServerManifest(v, l, lv = 'release', n, ss = 'default', resourcePath = RESOURCES_PATH) {
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();
        try {
            fs.mkdirSync(path.join(CAULDRON_PATH, "config"), { recursive: true });

            const ensureFile = (filePath) => {
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, "{}");
                }
            };


            ensureFile(path.join(CAULDRON_PATH, "config/assets_installed.json"));
            ensureFile(path.join(CAULDRON_PATH, "config/jvm_installed.json"));
            ensureFile(path.join(CAULDRON_PATH, "config/libs_installed.json"));

            const assetDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/assets_installed.json")).toString());
            const jvmDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/jvm_installed.json")).toString());
            const libDict = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, "config/libs_installed.json")).toString());

            let specPath = l !== 'vanilla' ? `/loaders/${l}/${v}/${lv}` : `/spec/${v}`
            let specLocation = l !== "vanilla" ? `${l}-${v}-${lv}` : v;

            const foundManifest = await checkManifest(path.join("versions", specLocation, `${specLocation}.json`), `${resourcePath}${specPath}`, 'spec')
            if (!foundManifest) {
                return reject({ message: `Version not ${l === "vanilla" ? "found" : `supported for loader: ${l}`}` });
            };
            if (foundManifest.id.includes("forge") || foundManifest.id.includes("fabric")) {
                if (!foundManifest.id.includes("minecraftforge")) {
                    v = foundManifest.id.split("-")[1]
                }

            } else {
                v = foundManifest.id;
            }
            lv = foundManifest.loaderVersion || foundManifest.version;
            const createdManifest = await addOSSpecArguments(foundManifest);
            let postData = null;
            if (createdManifest.requiresPost) {
                postData = await checkManifest(path.join("versions", specLocation, "post.json"), `${resourcePath}/loaders/${l}/${createdManifest.id.split("-")[1]}-${lv}/post.json`, "spec");
                let entryFile = postData.path;

                let foundEntryFile = postData.libraries.find(lib => lib.name == entryFile)

                if (foundEntryFile) {
                    createdManifest.downloads['runner_file'] = foundEntryFile.downloads.artifact;

                    if (!createdManifest.downloads['runner_file'].url) {
                        createdManifest.downloads['runner_file'].url = `${resourcePath}/loaders/forge/${v}-${lv}/forge-${v}-${lv}.jar`
                    }
                } else {
                    let original = entryFile;
                    // Attempt Universal Appending
                    entryFile = `${entryFile}`;
                    foundEntryFile = createdManifest.libraries.find(lib => lib.name == entryFile);
                    if (foundEntryFile) {
                        if (!foundEntryFile.downloads.artifact.url) {
                            foundEntryFile.downloads.artifact.url = `${resourcePath}/loaders/forge/${v}-${lv}/forge-${v}-${lv}.jar`
                            //foundEntryFile.downloads.artifact.sha1 = 'NONE';
                        }
                        createdManifest.downloads['runner_file'] = foundEntryFile.downloads.artifact;
                    }

                }
            }

            if (createdManifest.downloads.runner_file) {

                let runnerFileName = `${createdManifest.id}.jar`;

                if (createdManifest.downloads.runner_file.path) {
                    let extractedName = createdManifest.downloads.runner_file.path.split("/").pop();
                    runnerFileName = extractedName;
                }
                await checkJAR(path.join("servers", `${n}`, runnerFileName), createdManifest.downloads.runner_file.url);
                await checkJAR(path.join("servers", `${n}`, `minecraft_server.${v}.jar`), createdManifest.downloads.server.url);
            } else {
                if (l === 'vanilla' && ss !== 'default') {
                    await checkJAR(path.join("servers", `${n}`, `minecraft_server.${v}.jar`), createdManifest.downloads[ss].url);
                } else {
                    await checkJAR(path.join("servers", `${n}`, `minecraft_server.${v}.jar`), createdManifest.downloads.server.url);
                }


            }

            //process.exit(0)
            // JVM Only
            const jvmMeta = await checkManifest(path.join("jvm", "jvm-core.json"), "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json", "java");
            const jvmCompat = await checkCompat(createdManifest.javaVersion.component, jvmMeta);
            if (!jvmCompat) return reject("Version Not Supported on " + osCurrent);
            const jvmMani = await checkManifest(path.join("jvm", `${createdManifest.javaVersion.component}.json`), jvmCompat[0].manifest.url, "java");




            const allManifests = {
                spec: createdManifest,
                jvmMani,
                jvmComp: createdManifest.javaVersion.component,
                version: v,
                versionData: { loader: l, version: v, loaderVersion: lv },
                loader: l,
                assetsDownloaded: true,
                jvmDownloaded: !!jvmDict[createdManifest.javaVersion.component],
                libsDownloaded: true,
                isServer: true,
                loaderVersion: lv,
                needsPost: createdManifest.requiresPost,
                postData,

            };

            resolve(allManifests);
        } catch (err) {
            console.error(err);
            process.exit(0);
            reject(err);
        }
    })
}


async function startServer(sessionName, version, loader, lVersion, serverSoftware = 'default', overrides, rp) {
    if (!overrides) {
        overrides = { jvm: {}, game: {}, additG: {} };
    }
    if (!loader) {
        loader = "vanilla";
    }
    return new Promise(async (resolve, reject) => {
        let CAULDRON_PATH = grabPath();

        let serverPath = path.join(CAULDRON_PATH, 'servers', sessionName);

        if (!fs.existsSync(serverPath)) {
            fs.mkdirSync(serverPath, { recursive: true });
        }

        try {
            let verifiedLoaders = ["vanilla", "forge", "fabric", "neoforge"]
            const loaderAccepted = verifiedLoaders.includes(loader);
            if (!loaderAccepted) {
                reject('Loader Not Supported! Code: LSUPNF')
                return;
            }
            getOperatingSystem();
            let sessionID = createUUID()
            cauldronLogger.debug("Session ID: " + sessionID);
            //Create Bulk Manifests
            const manifests = await getServerManifest(version, loader, lVersion, sessionName, serverSoftware, rp);
            let libGet = await handleGrabDeps(manifests, null, path.join(serverPath, 'libraries'));
            if (loader !== "vanilla") {
                if (manifests.needsPost) {
                    if (loader === 'forge') {
                        libGet = await forge.postProcessing(manifests, libGet, version, 'server', path.join(serverPath, 'libraries'));
                    } else if (loader === 'neoforge') {
                        libGet = await neoforge.postProcessing(manifests, libGet, version, 'server', path.join(serverPath, 'libraries'));
                    }

                }
            }
            let launchPath = await buildLaunchScript(manifests.spec, manifests.jvmComp, sessionName);
            resolve({ launchPath, serverPath });

        } catch (err) {
            reject(err.message);
        }
    });
}