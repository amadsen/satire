/*
+ emits events when requests are received and responses are sent
+ file-based responses (particularly for GET requests)
+ other HTTP methods supported through modules
+ auto-reload when mock files change
+ optional proxy to actual APIs
*/

const http = require('http');
const path = require('path');
const chokidar = require('chokidar');
const configr8 = require('configr8');
const tryRequire = require('try-require');

const defaultSettings = {
    port: 0,
    mocks: '{test/,}mocks/**/*',
    watch: true
}

function satire({argv, settings}) {
    /*
    Get config
    */
    const config = configr8({
        name: 'satire',
        useEnv: true,
        useArgv: (true === argv),
        usePkg: true
    })(defaultSettings, settings);

    /*
    Watch mock directories
    */
    const mocks = {};
    const mockGlobs = [].concat(mocks)
        .map((glob) => {
            return path.isAbsolute(glob)?
                glob :
                path.posix.join(process.cwd(), glob);
        });
    const watcher = chokidar.watch(
        mockGlobs,
        {
            ignored: /(^|[\/\\])\../,
            cwd: process.cwd()
        }
    ).on('all', (event, path) => {
        /*
        TODO: debounce this, because multiple events fire when a file is changed
        */
        // regardless of what happened, if we got a path
        // try reloading it.
        // first clear the require cache
        delete require.cache[require.resolve(path)];
        let aMock = tryRequire(path, require);

        if(aMock){
            mocks[path] = aMock;
        } else {
            let err = tryRequire.lastError();
            if (err.code !== "MODULE_NOT_FOUND") {
                /* TODO: optional logger */
                console.error(err);
            } else {
                // remove any previous mock from the cache
                delete mocks[path];
            }
        }
    });

    /*
    TODO: set up server
    */
    watcher.on('ready', () => {
        //
    });
}

module.exports = satire;

if (module === process.mainModule) {
    // if we were started directly, treat it as though
    // we were started via the CLI
    require('./cli/satire.js');
}
