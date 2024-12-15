const axios = require('axios');
const {grabStaticFileServer} = require("./fileServerLocator");


async function findCustomLogger(loggerIdx) {
    return new Promise(async (resolve) => {
        try {
            let predictedPath = `${await grabStaticFileServer()}/logs/${loggerIdx}`;

            let config = {
                method: 'HEAD',
                url:predictedPath,
            }

            await axios(config);
            resolve(true);

        } catch (e) {
            resolve(false);
        }
    })
}

module.exports = {findCustomLogger};