const chokidar = require('chokidar');
const globby = require('globby');
const mm = require('micromatch');
const unixify = require('unixify');
const path = require('path');
const { EventEmitter } = require('events');

function sharedFsRoot(mockGlobs) {
    const fsRoot = path.parse(process.cwd()).root;
    const globs = [].concat(mockGlobs);
    const rootParts = globs
        .reduce((shared, aGlob) => {
            const parts = aGlob.split(path.posix.sep);
            if (shared) {
                let done = false;
                return shared.reduce((same, segment, i) => {
                    if (!done && segment === parts[i]) {
                        same.push(segment);
                    } else {
                        done = true;
                    }
                    return same;
                }, []);
            }
            return parts;
        }, null);

    const root = path.normalize(path.join(fsRoot, ...rootParts));
    return {
        root,
        globs: globs.map((g) => path.relative(root, g))
    };
}

module.exports = (mockGlobs) => {
    const exportedWatcher = new EventEmitter();
    const originalPaths = globby.sync(mockGlobs);
    /*
    NOTE: the construction of this watcher is predicated on working around various
    issues current in chokidar - particularly on windows - regarding watching multiple
    file roots and firing multiple ready events.
    */
    // watch a single, shared root (which could be huge, but, this is a workaround)
    const {
        root
    } = sharedFsRoot(mockGlobs);

    watcher = chokidar.watch(root, {});

    function onReady(){
        // on any event...
        watcher.on('all', (event, filepath, ...args) => {
            const posixFilepath = unixify(filepath);
            // filter events here as part of the workaround
            if (!mm.any(posixFilepath, mockGlobs)) {
                return;
            }
            // pass it through to our listener
            exportedWatcher.emit(event, filepath, ...args);
            exportedWatcher.emit('all', event, filepath, ...args);
        });
    }

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

        if (originalPaths.filter((filepath) => readyPaths.indexOf(filepath) === -1)) {
            onReady();
            exportedWatcher.emit('ready');
            return;
        }
    });

    // send errors out
    watcher.on('error', (...args) => exportedWatcher.emit('error', ...args));
 
    exportedWatcher.close = () => {
        watcher.close();
    };

    return exportedWatcher;
}
