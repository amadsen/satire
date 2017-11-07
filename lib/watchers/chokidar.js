const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const sharedFsRoot = require('../utils/shared-fs-root');
const manyglob = require('../utils/many-glob.js');
const trike = require('trike');

const find = manyglob();

module.exports = (mockGlobs) => {
    const exportedWatcher = new EventEmitter();
    const pathsPromise = find(mockGlobs);
    /*
    NOTE: the construction of this watcher is predicated on working around various
    issues current in chokidar - particularly on windows - regarding watching multiple
    file roots and firing multiple ready events.
    */
    // watch a single, shared root (which could be huge, but, this is a workaround)
    const {
        root
    } = sharedFsRoot(mockGlobs);

    watcher = chokidar.watch(root, {
        ignored: (filepath) => {
            let match = find.matcher(filepath, mockGlobs);
            if (!match) {
                // don't ignore directories regardless
                // TODO: this can be more efficient by focusing
                // on directories in the original paths
                match = trike(() => fs.lstatSync(filepath).isDirectory())[1];
            }
            return !match;
        }
    });

    // on any event...
    watcher.on('all', (event, filepath, ...args) => {
        // filter events here as part of the workaround
        if (!find.matcher(filepath, mockGlobs)) {
            return;
        }
        // pass it through to our listener
        exportedWatcher.emit(event, filepath, ...args);
        exportedWatcher.emit('all', event, filepath, ...args);
    });

    // for the ready event, ensure that all the file paths we should be watching are
    // accounted for.
    watcher.on('ready', () => {
        const watched = watcher.getWatched();
        const readyPaths = Object.keys(watched).reduce((allPaths, dir) => ([
            ...allPaths,
            ...watched[dir].map(
                (sub) => path.join(dir, sub)
            )
        ]), []);

        pathsPromise.then((originalPaths) => {
            const missing = originalPaths.filter(
                (filepath) => readyPaths.indexOf(filepath) === -1
            );
            if (missing.length < 1) {
                exportedWatcher.emit('ready');
                return;
            }
        });
    });

    // send errors out
    watcher.on('error', (...args) => exportedWatcher.emit('error', ...args));
 
    exportedWatcher.close = () => {
        watcher.close();
    };

    return exportedWatcher;
}
