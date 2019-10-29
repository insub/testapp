// @flow
import * as electron from 'electron';
import * as errorHandling from './main/error-handling';
import * as updates from './main/updates'; // 300ms
import * as windowUtils from './main/window-utils';
import * as models from './models/index'; // 300mx
import * as database from './common/database'; // 300ms
import { CHANGELOG_BASE_URL, getAppVersion, getAppTheme, isDevelopment, isMac } from './common/constants';
import type { ToastNotification } from './ui/components/toast';
import type { Stats } from './models/stats';
import path from 'path';

const { app, ipcMain, session } = electron;
const commandLineArgs = process.argv.slice(1);

// So if (window) checks don't throw
global.window = global.window || undefined;

// When the app is first launched
app.once('ready', async () => {
  // Init some important things first
  await database.init(models.types());
  await _fix();
  await errorHandling.init();
  await windowUtils.init();

  // Init the app
  await _trackStats();
  await _launchApp();
  // Init the rest
  // await updates.init();
  updates.init();
});

// 有时更新后需要执行一些跃迁工作
async function _fix(){

}

// Set as default protocol
// 开发环境的 windows 上使用自定义 url 可以打开 app 并传递参数，启动时的不用写在这里，在 _launchApp 函数里面写了
// If we are running a non-packaged version of the app && on windows
if(process.env.NODE_ENV === 'development' && process.platform === 'win32') {
  // remove so we can register each time as we run the app. 
  app.removeAsDefaultProtocolClient('apiplus-desktop-dev');
  // Set the path of electron.exe and your app.
  // These two additional parameters are only available on windows.
  app.setAsDefaultProtocolClient('apiplus-desktop-dev', process.execPath, [path.resolve(process.argv[1])]);        
} else {
  app.setAsDefaultProtocolClient(`apiplus-desktop${isDevelopment() ? '-dev' : ''}`);
  app.setAsDefaultProtocolClient(`apiplus-desktop-${getAppTheme()}${isDevelopment() ? '-dev' : ''}`);
}

function _addUrlToOpen(e, url) {
  console.warn("_addUrlToOpen", url)
  e.preventDefault();
  commandLineArgs.push(url);
}

app.on('open-url', _addUrlToOpen);

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});

// Mac-only, when the user clicks the doc icon
app.on('activate', (e, hasVisibleWindows) => {
  // Create a new window when clicking the doc icon if there isn't one open
  if (!hasVisibleWindows) {
    try {
      windowUtils.createWindow();
    } catch (e) {
      // This might happen if 'ready' hasn't fired yet. So we're just going
      // to silence these errors.
      console.log('[main] App not ready to "activate" yet');
    }
  }
});

function _launchApp() {
  app.removeListener('open-url', _addUrlToOpen);
  const window = windowUtils.createWindow();

  // Handle URLs sent via command line args
  ipcMain.once('window-ready', () => {
    commandLineArgs.length && window.send('run-command', commandLineArgs[0]);
    // 在这里处理两个窗口的关系
    const { maximize } = windowUtils.getBounds();
    window.show()
    if (maximize) {
      window.maximize();
    }
  });

  // Called when second instance launched with args (Windows)
  const gotTheLock = app.requestSingleInstanceLock();  
  if (!gotTheLock) {
    console.error('[app] Failed to get instance lock');
    return;
  }
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });    

  // Handle URLs when app already open
  app.addListener('open-url', (e, url) => {
    window.send('run-command', url);
    // Apparently a timeout is needed because Chrome steals back focus immediately
    // after opening the URL.
    setTimeout(() => {
      window.focus();
    }, 100);
  });

  // Don't send origin header from Apiplus app because we're not technically using CORS
  session.defaultSession.webRequest.onBeforeSendHeaders((details, fn) => {
    delete details.requestHeaders['Origin'];
    fn({ cancel: false, requestHeaders: details.requestHeaders });
  });
}

async function _trackStats() {
  // Handle the stats
  const oldStats = await models.stats.get();
  const stats: Stats = await models.stats.update({
    currentLaunch: Date.now(),
    lastLaunch: oldStats.currentLaunch,
    currentVersion: getAppVersion(),
    lastVersion: oldStats.currentVersion,
    launches: oldStats.launches + 1
  });

  // Update Stats Object
  const firstLaunch = stats.launches === 1;
  const justUpdated = !firstLaunch && stats.currentVersion !== stats.lastVersion;

  ipcMain.once('window-ready', () => {
    const { currentVersion } = stats;
    if (!justUpdated || !currentVersion) {
      return;
    }

    const { BrowserWindow } = electron;
    const notification: ToastNotification = {
      key: `updated-${currentVersion}`,
      url: `${CHANGELOG_BASE_URL}/${currentVersion}/`,
      cta: "See What's New",
      message: `Updated to ${currentVersion}`,
      email: 'support@apiplus.io'
    };

    // Wait a bit before showing the user because the app just launched.
    setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.send('show-notification', notification);
      }
    }, 5000);
  });
}
