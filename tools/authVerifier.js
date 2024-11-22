const axios = require('axios');
const { cauldronLogger } = require('./logger');

const {checkInternet } = require('./checkConnection');

// Verifies that the user owns a valid license of Minecraft

async function verifyAccessToken(access_token) {
    return new Promise(async (resolve) => {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://api.minecraftservices.com/entitlements/mcstore',
            headers: {
                'Authorization': 'Bearer ' + access_token
            }
        };
        try {
            await axios(config);
            resolve(true)
        } catch (err) {
            if (err.code) {
                if (err.code === 'ENOTFOUND') {
                    //Assume Offline
                    // Sets Client to Offline
                    cauldronLogger.warn("Error Communicating with MinecraftServices!");
                    cauldronLogger.warn("Is Client Offline?");
                    if (!await checkInternet()) {
                        cauldronLogger.warn("Confirmed Client is Offline");
                        cauldronLogger.warn("Skipping step be warned client may not be authenticated!");
                        resolve(true);
                    } else {
                        cauldronLogger.error("Client is Not Offline! Skipping Still!");
                        resolve(true)
                    }
                    
                } else {
                    resolve(false)
                }
            }
            resolve(true);
        }
    })
}

module.exports = { verifyAccessToken };