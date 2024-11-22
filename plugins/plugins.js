const { cauldronLogger } = require('../tools/logger');

async function checkManifestPlugin(loader,loaderVersion, version, getSpec,getLoaderManifest) {
    return new Promise(async (resolve, reject) => {
        try {
            let { getManifest } = require(`./${loader}/manifest`);
            const data = await getManifest(loaderVersion, version, getSpec,getLoaderManifest)
            resolve(data)
        } catch (err) {
            reject({message:'This Loader Is Not Supported! (Plugin May be missing a manifest file as well)'});
        }
    })
}

async function getDataPlugin(loader) {
    return new Promise(async (resolve, reject) => {
        try {
            let { getData } = require(`./${loader}/manifest`);
            const data = getData();
            resolve(data)
        } catch (err) {
            cauldronLogger.error("This Loader Is Not Supported! (Plugin May be missing a manifest file as well)")
           reject({message:'This Loader Is Not Supported! (Plugin May be missing a manifest file as well)'})
        }
    })
}

async function getIdentifierPlugin(loader,version,manifest) {
    return new Promise(async (resolve, reject) => {
        try {
            let { identifier } = require(`./${loader}/identifier`);
            const data = await identifier(version,manifest);
            resolve(data)
        } catch (err) {
            reject({message:err});
        }
    })
}

async function getPostPlugin(loader,manifest) {
    return new Promise(async (resolve) => {
        try {
            let { postProcessing } = require(`./${loader}/post`);
            const data = await postProcessing(manifest);
            resolve(data)
        } catch (err) {
            cauldronLogger.warn("Plugin Does not support the post function. There may be errors ahead")
            resolve(false);
        }
    })
}


async function getJVMArgsPlugin(loader,args) {
    return new Promise(async (resolve) => {
        try {
            let { jvm } = require(`./${loader}/launch`);
            const data = await jvm(args);
            resolve(data)
        } catch (err) {
            cauldronLogger.warn("Plugin Does not support the jvmArgs function. There may be errors ahead")
            resolve(false);
        }
    })
}




module.exports = { checkManifestPlugin,getDataPlugin,getIdentifierPlugin, getPostPlugin,getJVMArgsPlugin }