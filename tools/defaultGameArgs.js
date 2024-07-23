const { grabPath } = require('../tools/compatibility');

function getGameVars(auth,manifest,overides) {
    var CAULDRON_PATH = grabPath();
    var defaults = {
        auth_player_name:auth.profile.username,
        version_type:manifest.type,
        game_directory:CAULDRON_PATH,
        server_ip:'',
    };
    for (idx in overides) {
        defaults[idx] = overides[idx]
    }
    return defaults;
}

module.exports = {getGameVars}