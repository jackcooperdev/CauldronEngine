import {cauldronLogger} from "../tools/logger.js";

async function checkManifestPlugin(loader, loaderVersion, version, getSpec, getLoaderManifest,) {
    return new Promise(async (resolve, reject) => {
        try {
            const {getManifest} = await import(`./${loader}/manifest.js`);
            const data = await getManifest(loaderVersion, version, getSpec, getLoaderManifest,);
            resolve(data);
        } catch (err) {
            reject({message: "This Loader Is Not Supported! (Plugin May be missing a manifest file as well) (a)",});
        }
    });
}

async function getDataPlugin(loader) {
    return new Promise(async (resolve, reject) => {
        try {
            const {getData} = await import(`./${loader}/manifest.js`);
            const data = getData();
            resolve(data);
        } catch (err) {
            reject({message: "This Loader Is Not Supported! (Plugin May be missing a manifest file as well) (b)",});
        }
    });
}

async function getIdentifierPlugin(loader, version, manifest) {
    return new Promise(async (resolve, reject) => {
        try {
            const {identifier} = await import(`./${loader}/identifier.js`);
            const data = await identifier(version, manifest);
            resolve(data);
        } catch (err) {
            reject({message: err});
        }
    });
}

async function getPostPlugin(loader, manifest) {
    return new Promise(async (resolve) => {
        try {
            const {postProcessing} = await import(`./${loader}/post.js`);
            const data = await postProcessing(manifest);
            resolve(data);
        } catch (err) {
            cauldronLogger.warn("Plugin Does not support the post function. There may be errors ahead",);
        }
    });
}

async function getJVMArgsPlugin(loader, args) {
    return new Promise(async (resolve,reject) => {
        try {
            const {jvm} = await import(`./${loader}/launch.js`);
            const data = await jvm(args);
            resolve(data);
        } catch (err) {
            cauldronLogger.error(err);
            reject(err);
        }
    });
}

export {checkManifestPlugin, getDataPlugin, getIdentifierPlugin, getPostPlugin, getJVMArgsPlugin,};
