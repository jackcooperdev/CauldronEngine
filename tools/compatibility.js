const osCurrent = require('os').platform();
const path = require('path')
const homedir = require('os').homedir();
const fs = require('fs');
const shell = require('shelljs');
var configData = {};




function grabPath() { 
    const WORKING_DIR = '.cauldron';
    if (osCurrent == 'win32') {
        pathReturn = path.join(homedir, 'AppData', 'Roaming', WORKING_DIR)
    } else if (osCurrent == 'linux' || osCurrent == 'darwin') {
        pathReturn = path.join(homedir, WORKING_DIR);
    }
    shell.mkdir('-p',path.join(pathReturn))
   return pathReturn

};



module.exports = { grabPath  }