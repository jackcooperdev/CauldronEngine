async function launchGame(version, dry, loader, lVersion, authData) {
    if (!dry) {
        dry = false;
    };
    if (!loader) {
        loader = 'vanilla';
    };
    return new Promise(async (resolve) => {
        var CAULDRON_PATH = grabPath();
        try {
            var sessionID = createSession();
            cauldronLogger.info("Session ID: " + sessionID);
            cauldronLogger.info(`Version Verified and Manifest Found`);
            if (!dry) {
                verify = await verifyAccessToken(authData.access_token);
                cauldronLogger.info('Authentication Passed');
            };
            const isClientNotHere = isOffline();
            if (!isClientNotHere) {
                const updateLocalManififest = await downloadVersionManifests(MAIN_MANIFEST, true, false);
            }
            cauldronLogger.info('Version Requested: ' + version);
            cauldronLogger.info('Loader Requested: ' + loader)
            const setVersion = await whatIsThis(version, loader, lVersion);
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
            if (!isClientNotHere) {
                cauldronLogger.info('Starting Asset Download');
                cauldronLogger.info(`Index No: ${convertedManifest.assets}`);
                cauldronLogger.info(`Index URL: ${convertedManifest.assetIndex.url}`)
                const assetGet = await getAssets(convertedManifest.assets, convertedManifest.assetIndex.url)
            };
            cauldronLogger.info('Starting Library Download')
            const libGet = await getLibraries(convertedManifest.libraries, osCurrent, setVersion);
            if (!dry) {
                cauldronLogger.info('All Files Aquired Building Launch File');
                cauldronLogger.info('Creating JVM Arguments');
                var validRules = await buildJVMRules(convertedManifest, libGet, setVersion);
                cauldronLogger.info('Generating Game Arguments')
                var gameRules = await buildGameRules(convertedManifest, authData, setVersion);
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