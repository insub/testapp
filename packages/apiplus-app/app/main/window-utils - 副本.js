import electron from 'electron';
import path from 'path';
import fs from 'fs';
import LocalStorage from './local-storage';
import {
  CHANGELOG_BASE_URL,
  getAppLongName,
  getAppName,
  getAppVersion,
  getAppTheme,
  getAppPlatform,
  isDevelopment,
  isMac
} from '../common/constants';
import * as misc from '../common/misc';

const { app, Menu, BrowserWindow, shell, dialog, Tray } = electron;

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MINIMUM_WIDTH = 500;
const MINIMUM_HEIGHT = 400;

let tray = null;
let mainWindow = null;
let splashWindow = null;
let localStorage = null;

export function init() {
  initLocalStorage();
  initContextMenus();
}

console.warn("!!!!!!!!!! window-utils.js --------------- ")
// Force Single Instance Application
const shouldQuit = app.makeSingleInstance((argv, workingDirectory) => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
      mainWindow.focus()
    }
    // windows 上使用自定义 url 可以打开 app 并传递参数，启动时的不用写在这里，在 _launchApp 函数里面写了
    if (process.platform == 'win32' || process.platform == 'linux') {
      mainWindow.send('run-command', argv.slice(-1)[0]);
      setTimeout(() => {
        mainWindow.focus();
      }, 100);
    }
  }
})

if (shouldQuit) {
  app.quit()
}

export function createSplashWindow() {
  const zoomFactor = getZoomFactor();
  const { bounds, fullscreen, maximize } = getBounds();
  const { x, y, width, height } = bounds;

  // Make sure we don't place the window outside of the visible space
  let maxX = 0;
  let maxY = 0;
  for (const d of electron.screen.getAllDisplays()) {
    // Set the maximum placement location to 50 pixels short of the end
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width - 50);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height - 50);
  }
  const finalX = Math.min(maxX, x);
  const finalY = Math.min(maxX, y);

  splashWindow = new BrowserWindow({
    x: finalX,
    y: finalY,
    fullscreen: false,
    fullscreenable: false,
    title: getAppName(),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    backgroundColor: '#22252b',
    transparent: false,
    frame: false,
    hasShadow: true,
    devTools: true,
    transparent: false,
    titleBarStyle: 'hidden',
    icon: path.resolve(__dirname, 'static/icon.png'),
    alwaysOnTop: false,
    resizable: false,
    show: false
  });

  splashWindow.loadURL(`file://${__dirname}/static/splash.html`);

  splashWindow.once('ready-to-show', () => {
    let code = `var body = document.getElementsByTagName('body')[0];
            body.setAttribute("data-platform", "${getAppPlatform()}");body.setAttribute("theme", "apiplus-${getAppTheme()}");`;
    splashWindow.webContents.executeJavaScript(code);
    splashWindow.show()
    if (maximize) {
      splashWindow.maximize();
    }
    setTimeout(() => {
      createTray();
      require("../main.development.real")
    }, 1000);

  })

  return splashWindow;
}

export function createWindow() {
  const zoomFactor = getZoomFactor();
  const { bounds, fullscreen, maximize } = getBounds();
  const { x, y, width, height } = bounds;

  // Make sure we don't place the window outside of the visible space
  let maxX = 0;
  let maxY = 0;
  for (const d of electron.screen.getAllDisplays()) {
    // Set the maximum placement location to 50 pixels short of the end
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width - 50);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height - 50);
  }
  const finalX = Math.min(maxX, x);
  const finalY = Math.min(maxX, y);

  mainWindow = new BrowserWindow({
    // Make sure we don't initialize the window outside the bounds
    x: finalX,
    y: finalY,
    // 先不要全屏，全屏无法隐藏窗口
    fullscreen: false,
    fullscreenable: true,
    title: getAppName(),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    minHeight: MINIMUM_HEIGHT,
    minWidth: MINIMUM_WIDTH,
    acceptFirstMouse: true,
    icon: path.resolve(__dirname, 'static/icon.png'),
    webPreferences: {
      zoomFactor: zoomFactor,
      webSecurity: false
    },
    // 是否显示边框
    frame: false,
    hasShadow: true,
    transparent: false,
    titleBarStyle: 'hidden',
    devTools: true,
    backgroundColor: '#22252b',
    show: false // don't show the main window
    // hidden 、hiddenInset、customButtonsOnHover
  });
  
  // if main window is ready to show, then destroy the splash window and show up the main window
  // or mainWindow.webContents.on('did-finish-load', function() {
  // mainWindow.once('ready-to-show', function() {
  //   setTimeout(() => {
  //     // mainWindow.setFullScreen(fullscreen)
  //     // mainWindow.show();
  //     // splashWindow.destroy();
  //     // BrowserWindow doesn't have an option for this, so we have to do it manually :(
  //     // if (maximize) {
  //     //   mainWindow.maximize();
  //     // }
  //   }, 800);
  // });

  mainWindow.on('resize', e => saveBounds());

  mainWindow.on('maximize', e => saveBounds());

  mainWindow.on('unmaximize', e => saveBounds());

  mainWindow.on('move', e => saveBounds());

  mainWindow.on('unresponsive', e => {
    showUnresponsiveModal();
  });

  // Load the html of the app.
  const url = process.env.APP_RENDER_URL;
  const appUrl = url || `file://${app.getAppPath()}/renderer.html`;
  console.log(`[main] Loading ${appUrl}`);
  mainWindow.loadURL(appUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // 菜单项，已被隐藏
  const applicationMenu = {
    label: 'Application',
    submenu: [
      ...(isMac()
        ? [{ label: `About ${getAppName()}`, role: 'about' }, { type: 'separator' }]
        : []),
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        click: function(menuItem, window, e) {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences');
        }
      },
      // {
      //   label: 'Changelog',
      //   click: function(menuItem, window, e) {
      //     if (!window || !window.webContents) {
      //       return;
      //     }
      //     misc.clickLink(`${CHANGELOG_BASE_URL}/${getAppVersion()}/`);
      //   }
      // },
      ...(isMac() ? [{ type: 'separator' }, { role: 'hide' }, { role: 'hideothers' }] : []),
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]
  };

  const editMenu = {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:'
      }
    ]
  };

  const viewMenu = {
    label: 'View',
    submenu: [
      { role: 'togglefullscreen' },
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = 1;
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        }
      },
      {
        label: 'Zoom In',
        accelerator: isMac() ? 'CmdOrCtrl+Plus' : 'CmdOrCtrl+=',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.min(1.8, getZoomFactor() + 0.05);
          window.webContents.setZoomFactor(zoomFactor);

          saveZoomFactor(zoomFactor);
        }
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          const zoomFactor = Math.max(0.5, getZoomFactor() - 0.05);
          window.webContents.setZoomFactor(zoomFactor);
          saveZoomFactor(zoomFactor);
        }
      },
      {
        label: 'Toggle Sidebar',
        accelerator: 'CmdOrCtrl+\\',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('toggle-sidebar');
        }
      }
    ]
  };

  const windowMenu = {
    label: 'Window',
    role: 'window',
    submenu: [{ role: 'minimize' }, ...(isMac() ? [] : [])]
  };

  const helpMenu = {
    label: 'Help',
    role: 'help',
    id: 'help',
    submenu: [
      {
        label: 'Contact Support',
        click: () => {
          shell.openExternal('https://apiplus.io');
        }
      },
      {
        label: 'Keyboard Shortcuts',
        click: (menuItem, window, e) => {
          if (!window || !window.webContents) {
            return;
          }
          window.webContents.send('toggle-preferences-shortcuts');
        }
      },
      // {
      //   label: 'Show App Data Folder',
      //   click: (menuItem, window, e) => {
      //     const directory = app.getPath('userData');
      //     shell.showItemInFolder(directory);
      //   }
      // },
      // {
      //   label: 'Insomnia Help',
      //   click: () => {
      //     shell.openExternal('https://support.insomnia.rest');
      //   }
      // }
    ]
  };

  if (!isMac()) {
    helpMenu.submenu.unshift({
      label: 'About',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: getAppName(),
          message: getAppLongName(),
          detail: [
            'Version ' + getAppVersion(),
            'Shell ' + process.versions['atom-shell'],
            'Node ' + process.versions.node,
            'V8 ' + process.versions.v8,
            'Architecture ' + process.arch
          ].join('\n')
        });
      }
    });
  }

  const developerMenu = {
    label: 'Developer',
    position: 'before=help',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'Shift+F5',
        click: () => mainWindow.reload()
      },
      {
        label: 'Toggle DevTools',
        accelerator: 'Alt+CmdOrCtrl+I',
        click: () => mainWindow.toggleDevTools()
      },
      {
        label: 'Resize to Default',
        click: () =>
          mainWindow.setBounds({
            x: 100,
            y: 100,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT
          })
      },
      {
        label: 'Take Screenshot',
        click: function() {
          mainWindow.capturePage(image => {
            const buffer = image.toPNG();
            const dir = app.getPath('desktop');
            fs.writeFileSync(path.join(dir, `Screenshot-${new Date()}.png`), buffer);
          });
        }
      }
    ]
  };

  const toolsMenu = {
    label: 'Tools',
    submenu: [
      {
        label: 'Reload Plugins',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          const window = BrowserWindow.getFocusedWindow();
          if (!window || !window.webContents) {
            return;
          }

          window.webContents.send('reload-plugins');
        }
      }
    ]
  };

  let template = [];

  template.push(applicationMenu);
  template.push(editMenu);
  template.push(viewMenu);
  template.push(windowMenu);
  // template.push(toolsMenu);
  template.push(helpMenu);

  if (isDevelopment() || process.env.APIPLUS_FORCE_DEBUG) {
    template.push(developerMenu);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return mainWindow;
}

// https://github.com/kevinsawicki/tray-example/blob/master/main.js
export const createTray = () => {
  if (isDevelopment() || isMac()){
    return
  }
  tray = new Tray(path.resolve(__dirname, 'static/icon.ico'))
  //系统托盘右键菜单
  const trayMenu = [
    {
      label: 'Exit',
      click: () => {
        app.quit()
      }
    }
  ];
  //图标的上下文菜单
  const contextMenu = Menu.buildFromTemplate(trayMenu);
  //设置此托盘图标的悬停提示内容
  tray.setToolTip(`Apiplus ${getAppTheme()} ${getAppVersion()}`);
  //设置此图标的上下文菜单
  tray.setContextMenu(contextMenu);

  tray.on('right-click', showWindow)
  tray.on('double-click', showWindow)
  tray.on('click', function (event) {
    showWindow()
  })
}

const showWindow = () => {
  // const position = getWindowPosition()
  // window.setPosition(position.x, position.y, false)
  mainWindow.show()
  mainWindow.focus()
}

const getWindowPosition = () => {
  const windowBounds = mainWindow.getBounds()
  const trayBounds = tray.getBounds()

  // Center window horizontally below the tray icon
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))

  // Position window 4 pixels vertically below the tray icon
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  return {x: x, y: y}
}

function showUnresponsiveModal() {
  dialog.showMessageBox(
    {
      type: 'info',
      buttons: ['Cancel', 'Reload'],
      defaultId: 1,
      cancelId: 0,
      title: 'Unresponsive',
      message: 'apiplus has become unresponsive. Do you want to reload?'
    },
    id => {
      if (id === 1) {
        mainWindow.destroy();
        createWindow();
      }
    }
  );
}

function saveBounds() {
  if (!mainWindow) {
    return;
  }

  const fullscreen = mainWindow.isFullScreen();

  // Only save the size if we're not in fullscreen
  if (!fullscreen) {
    localStorage.setItem('bounds', mainWindow.getBounds());
    localStorage.setItem('maximize', mainWindow.isMaximized());
    localStorage.setItem('fullscreen', false);
  } else {
    localStorage.setItem('fullscreen', true);
  }
}

export function getBounds() {
  let bounds = {};
  let fullscreen = false;
  let maximize = false;
  try {
    bounds = localStorage.getItem('bounds', {});
    fullscreen = localStorage.getItem('fullscreen', false);
    maximize = localStorage.getItem('maximize', false);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse window bounds', e);
  }

  return { bounds, fullscreen, maximize };
}

function saveZoomFactor(zoomFactor) {
  localStorage.setItem('zoomFactor', zoomFactor);
}

function getZoomFactor() {
  let zoomFactor = 1;
  try {
    zoomFactor = localStorage.getItem('zoomFactor', 1);
  } catch (e) {
    // This should never happen, but if it does...!
    console.error('Failed to parse zoomFactor', e);
  }

  return zoomFactor;
}

function initLocalStorage() {
  const localStoragePath = path.join(app.getPath('userData'), 'localStorage');
  localStorage = new LocalStorage(localStoragePath);
}

function initContextMenus() {
  require('electron-context-menu')({});
}
