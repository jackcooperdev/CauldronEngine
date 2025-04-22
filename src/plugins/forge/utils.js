import path from "path";
import fs from "fs";
import axios from "axios";
import { grabPath } from "../../tools/compatibility.js";

// Important Links
const FORGE_REPO = "https://maven.minecraftforge.net/net/minecraftforge";

// Files
import suffixes from "./files/suffixes.json" with { type: "json" };

let suffixUsed = "";
// Get Forge Installer URL (does what it says on the tin)
async function getForgeInstallerURL(version, forgeVersion) {
  let url = "";
  let CAULDRON_PATH = grabPath();
  let acquiredForges;
  if (!fs.existsSync(path.join(CAULDRON_PATH, "forge-installers.json"))) {
    acquiredForges = {};
    fs.writeFileSync(path.join(CAULDRON_PATH, "forge-installers.json"), "{}");
  } else {
    acquiredForges = JSON.parse(
      fs
        .readFileSync(path.join(CAULDRON_PATH, "forge-installers.json"))
        .toString(),
    );
  }
  if (acquiredForges[`${version}-${forgeVersion}`]) {
    url = acquiredForges[`${version}-${forgeVersion}`].url;
    if (acquiredForges[`${version}-${forgeVersion}`].suffix) {
      suffixUsed = acquiredForges[`${version}-${forgeVersion}`].suffix;
    }
  } else {
    if (suffixes[version]) {
      for (let idx in suffixes[version]) {
        url = `${FORGE_REPO}/forge/${version}-${forgeVersion}${suffixes[version][idx]}/forge-${version}-${forgeVersion}${suffixes[version][idx]}-installer.jar`;
        const validateURL = await checkInstaller(url);
        suffixUsed = suffixes[version][idx];
        if (validateURL) {
          acquiredForges[`${version}-${forgeVersion}`] = {
            url: "",
            suffix: "",
          };
          acquiredForges[`${version}-${forgeVersion}`]["url"] = url;
          acquiredForges[`${version}-${forgeVersion}`]["suffix"] = suffixUsed;
          fs.writeFileSync(
            path.join(CAULDRON_PATH, "forge-installers.json"),
            JSON.stringify(acquiredForges),
          );
          break;
        }
      }
    } else {
      acquiredForges[`${version}-${forgeVersion}`] = { url: "", suffix: "" };
      url = `${FORGE_REPO}/forge/${version}-${forgeVersion}/forge-${version}-${forgeVersion}-installer.jar`;
      acquiredForges[`${version}-${forgeVersion}`]["url"] = url;
      fs.writeFileSync(
        path.join(CAULDRON_PATH, "forge-installers.json"),
        JSON.stringify(acquiredForges),
      );
    }
    if (!url) {
      throw new Error(
        `Sorry but Cauldron does not support ${version} - ${forgeVersion} forge yet. CODE: URLNFOUNDA`,
      );
    }
  }
  let verifyInstaller = await checkInstaller(url);
  if (verifyInstaller) {
    return url;
  } else {
    throw new Error(
      `Sorry but Cauldron does not support ${version} - ${forgeVersion} forge yet. CODE: URLNFOUNDB`,
    );
  }
}

// Checks Installer Link to see if its valid
async function checkInstaller(url) {
  let config = {
    method: "get",
    url: url,
  };
  try {
    await axios(config);
    return true;
  } catch (err) {
    return false;
  }
}

function convertNameToPath(name) {
  let split = name.split(":");
  let chunkOne = split[0].split(".").join("/");
  let chunkTwo = split[1];
  let chunkThree = split[2];
  return { chunkOne: chunkOne, chunkTwo: chunkTwo, chunkThree: chunkThree };
}
// Util Functions
function getSuffixUsed() {
  if (!suffixUsed) {
    suffixUsed = "";
  }
  return suffixUsed;
}
export { getForgeInstallerURL, convertNameToPath, getSuffixUsed };
