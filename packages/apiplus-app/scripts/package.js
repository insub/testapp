const electronBuilder = require('electron-builder');
const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs');
const buildTask = require('./build');
const packageJSON = require('../package.json');

const PLATFORM_MAP = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win'
};

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await buildTask.start();
      await module.exports.start();
    } catch (err) {
      console.warn('ERROR: ', err.stack);
    }
  });
}

module.exports.start = async function() {
  console.log('[package] Removing existing directories');
  await emptyDir('../dist/*');

  await pkg('../.electronbuilder');

  // insub：列出所有的 dist 里面的文件
  const util = require('util')
  var rez = walkSync('../apiplus-app/dist/');
  console.log("distFiles without unpacked folder => ", util.inspect(rez, {depth: 6, colors: true, maxArrayLength: 300}) )

  console.log('[package] Complete!');
};

async function pkg(relConfigPath) {
  try {
    const configPath = path.resolve(__dirname, relConfigPath);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const targetPlatform = PLATFORM_MAP[process.platform];
    process.env.PRODUCT_THEME = packageJSON.app.theme
    return electronBuilder.build({
      appId: `com.apiplus.${packageJSON.app.theme}.app`,
      protocols: [{
        name: `apiplus-desktop-${packageJSON.app.theme}`,
        schemes: ["apiplus-desktop", `apiplus-desktop-${packageJSON.app.theme}`]
      }],
      config,
      cscLink: process.env.CSC_LINK,
      cscKeyPassword: process.env.CSC_KEY_PASSWORD,
      [targetPlatform]: config[targetPlatform].target,
    });
  } catch (err) {
    console.log('[package] Failed: ' + err.stack);
    throw err;
  }
}

async function emptyDir(relPath) {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(__dirname, relPath);
    rimraf(dir, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// insub
var walkSync = function(dir, filelist) {
  var path = path || require('path');
  var fs = fs || require('fs'),
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = walkSync(path.join(dir, file), filelist);
      } else {
        if ( !dir.match(/unpacked/) ) {
          filelist.push(path.join(dir, file));
        }
      }
  });
  return filelist;
};