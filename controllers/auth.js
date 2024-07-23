const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const homedir = require('os').homedir();
const { cauldronLogger } = require('../tools/logger');
const { verifyMinecraft } = require('../tools/authChecker');



// Login User

async function verifyAccessToken(access_token) {
    return new Promise(async (resolve,reject) => {
        try {
            const verify = await verifyMinecraft(access_token);
            resolve(verify);
        } catch (err) {
            reject(err);
        };
    })
};

module.exports = { verifyAccessToken }