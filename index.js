const cron = require('node-cron');
const {app, BrowserWindow} = require('electron');
const request = require('request');
const fs = require('fs');
const unzipper = require('unzipper');
const fetch = require('node-fetch');
const progress = require('request-progress');
const ProgressBar = require('electron-progressbar');
const express = require('express');
let isUpdating = false;
let window = null;

cron.schedule('0 6 * * *', () => {
    update();
});

if (require('electron-squirrel-startup')) {
    app.quit();
}

let instance;

const APP_FILES = app.getPath('appData') + '/smartscreen';

const startup = () => {
    const server = express();
    server.use(express.static(`${APP_FILES}/app`));
    instance = server.listen(0, () => {
        console.log(instance.address().port);
    });
    update();
};

const update = () => {
    isUpdating = true;
    let progressBar = new ProgressBar({
        title: 'Wird aktualisiert',
        text: 'Wird aktualisiert',
        detail: 'Suche nach Updates ...',
        indeterminate: false,
        browserWindow: {
            parent: null,
            modal: true,
            resizable: false,
            closable: false,
            minimizable: false,
            maximizable: false,
            width: 500,
            height: 170,
            webPreferences: {
                nodeIntegration: true
            },
        }
    });
    fs.readFile(`${APP_FILES}/app/version.json`, (err, data) => {
        let version;
        try {
            version = JSON.parse(data);
        } catch (e) {
            version = [];
        }
        fetch('https://smartscreen.alexkutschera.eu' + ((version.VERSION_NUMBER !== undefined) ? '?VERSION_NUMBER=' + version.VERSION_NUMBER : '')).then(res => res.json()).then(data => {
            if (data.VERSION_NUMBER !== undefined && data.VERSION_NUMBER != version.VERSION_NUMBER) {
                progressBar.detail = 'Updates werden heruntergeladen ...';
                progressBar.value = 0;
                progress(request(`https://hipbib.alexkutschera.eu/versions/${data.VERSION_NUMBER}.zip`), {throttle: 100})
                    .on('progress', state => {
                        progressBar.value = state.percent * 100;
                    })
                    .pipe(unzipper.Extract({path: `${APP_FILES}/app`}))
                    .on('close', () => {
                        if(fs.existsSync(`${APP_FILES}/app/postInstall.js`)){

                        } else {
                            progressBar.setCompleted();
                            launch();
                        }
                    });
            } else {
                progressBar.setCompleted();
                launch();
            }
        }).catch(() => {
            progressBar.setCompleted();
            launch();
        });
    });

};

const launch = () => {
    if (window !== null) {
        window.close();
    }
    window = createWindow();
    // window.webContents.openDevTools();
    window.loadURL(`http://localhost:${instance.address().port}`);
    isUpdating = false;
};

let windows = [];

/**
 * @returns {Electron.BrowserWindow}
 */
const createWindow = () => {
    let window = new BrowserWindow({
        width: 800,
        height: 600,
        fullscreen: true,
        kiosk: true,
    });
    window.removeMenu();
    window.setMenuBarVisibility(false);
    windows.push(window);

    window.on('closed', () => {
        windows.slice(windows.indexOf(window), 1);
        console.log(windows);
    });
    return window;
};

app.on('ready', startup);

app.on('window-all-closed', () => {
    if (!isUpdating) {
        app.quit();
    }
});
