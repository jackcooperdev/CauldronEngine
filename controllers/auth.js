const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const homedir = require('os').homedir();
const { cauldronLogger } = require('../tools/logger');
const path = require('path');

const jwt = require('jsonwebtoken');
const MAS = require('../tools/MAS')

const { grabPath, getConfig } = require('../tools/compatibility');
const appConfig = getConfig();
var CAULDRON_PATH = grabPath();

// Grab Array of Authenticated Users
function getAuthedUsers() {
    try {
        var authFile = JSON.parse(fs.readFileSync(path.join(CAULDRON_PATH, 'cauldron_auth.json')));
        if (authFile) {
            var sessions = authFile.sessions;
            var loggedProfiles = new Array();
            for (idx in sessions) {
                var obj = {
                    email_safe: idx.replace(/(\w{3})[\w.-]+@([\w.]+\w)/, "$1***@$2"),
                    email: idx,
                    username: sessions[idx].username,
                    uuid: sessions[idx].uuid,
                }
                loggedProfiles.push(obj)
            };
            return loggedProfiles;
        }
    } catch (err) {
        return [];
    };
};

// Get Email from UUID

function getEmail(uuid) {
    uuid = uuid.split("-").join("");
    uuid = uuid.split(" ").join("");
    var users = getAuthedUsers();
    for (idx in users) {
        if (users[idx].uuid == uuid) {
            return users[idx].email;
        };
    };
    return false;
};

// Login User

async function authenticate(identifier) {
    return new Promise(async (resolve,reject) => {
        try {
            if (!identifier.includes("@")) {
                //Assume UUID
                var email = getEmail(identifier);
                if (email) {
                    cauldronLogger.info(`Converted UUID ${identifier} to Email ${email}`);
                    identifier = email;
                } else {
                    throw new Error('No Logged In User with UUID: '+identifier + ' Please login');
                };
            };
            var grabCurInfo = await MAS.grabAccessToken(identifier);
            var attemptToVerify = await MAS.verifyMinecraft(grabCurInfo.access_token);
            if (attemptToVerify) {
                cauldronLogger.info("Restoring Previous Auth Session");
                var profileData = await MAS.getProfileData(grabCurInfo.access_token, identifier);
                resolve({ profile: profileData, xui: grabCurInfo.xui, access_token: grabCurInfo.access_token, user_id: grabCurInfo.user_id });
            } else {
                var tokenRedeemed = await MAS.attemptToRefresh(identifier);
                if (!tokenRedeemed) {
                    cauldronLogger.info('Login Required')
                    const response = await MAS.waitForResponse();
                    tokenRedeemed = await MAS.redeemToken(response, identifier);
                };
                const XBLIVEAuth = await MAS.authenticateXboxLive(tokenRedeemed);
                const MOJANGAuth = await MAS.authorizeMojang(XBLIVEAuth.Token, identifier);
                const MINEAuth = await MAS.authenticateMinecraft(MOJANGAuth.Token, MOJANGAuth.DisplayClaims.xui[0].uhs, identifier);
                const MINEVerify = await MAS.verifyMinecraft(MINEAuth.access_token);
                const profileData = await MAS.getProfileData(MINEAuth.access_token, identifier);
                resolve({ profile: profileData, xui: MOJANGAuth.DisplayClaims.xui[0].uhs, access_token: MINEAuth.access_token, user_id: MINEAuth.username });
            }
        } catch (err) {
            reject(err);
        };
    })
};

async function logout(identifier) {
    MAS.writeToAuthFile(identifier, {}, true);
};


module.exports = { authenticate, logout, getAuthedUsers }