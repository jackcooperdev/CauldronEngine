const osCurrent = require('os').platform();
const path = require('path')
const configMain = require('../config.json');
const homedir = require('os').homedir();
const fs = require('fs');
const shell = require('shelljs');




function grabPath() { 
    if (osCurrent == 'win32') {
        pathReturn = path.join(homedir, 'AppData', 'Roaming', configMain.WORKING_DIR)
    } else if (osCurrent == 'linux') {
        pathReturn = path.join(homedir, configMain.WORKING_DIR);
    }
    shell.mkdir('-p',path.join(pathReturn))
   return pathReturn

};



module.exports = { grabPath }