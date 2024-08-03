const path = require('path');
const { cauldronLogger } = require('../tools/logger');

async function checkManifestPlugin(loader,loaderVersion, version, getSpec,getLoaderManifest) {
    return new Promise(async (resolve, reject) => {
        try {
            var { getManifest } = require(`./${loader}/manifest`);
            const data = await getManifest(loaderVersion, version, getSpec,getLoaderManifest)
            resolve(data)
        } catch (err) {
            reject({message:'This Loader Is Not Supported! (Plugin May be missing a manifest file as well)'});
        };
    })
};

async function getDataPlugin(loader) {
    return new Promise(async (resolve, reject) => {
        try {
            var { getData } = require(`./${loader}/manifest`);
            const data = getData();
            resolve(data)
        } catch (err) {
            cauldronLogger.warn("Plugin Does not support the getData function. There may be errors ahead")
            resolve(false);
        };
    })
};

async function getIdentifierPlugin(loader,version,manifest) {
    return new Promise(async (resolve, reject) => {
        try {
            var { identifier } = require(`./${loader}/identifier`);
            const data = await identifier(version,manifest);
            resolve(data)
        } catch (err) {
            reject({message:'This Loader Is Not Supported! (Plugin May be missing a identifier file as well)'});
        };
    })
};


module.exports = { checkManifestPlugin,getDataPlugin,getIdentifierPlugin }