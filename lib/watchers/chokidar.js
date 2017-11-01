const chokidar = require('chokidar');
const globby = require('globby');
const mm = require('micromatch');
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

    const root = path.normalize(path.join(fsRoot, ...(rootParts || null)));
    return {
        root,
        globs: globs.map((g) => path.relative(root, g))
    };
}

// function watchedPaths(basePath, obj) {
//     Object.keys(obj).reduce((allPaths, dir) => ([
//         ...allPaths,
//         ...obj[dir].map(
//             (sub) => path.join(dir, sub)
//         )
//     ]), [basePath]);
// }

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
        root,
        globs
    } = sharedFsRoot(mockGlobs);

    watcher = chokidar.watch(root, {
        ignore: function(filepath){
            // we 'ignore' paths that don't match our globs
            // It might be possible to just negate the globs and let 
            // chokidar's anymatch handle it, but we're being explicit
            // in our use of micromatch
            return !mm.any(filepath, mockGlobs);
        }
    });

    function onReady(){
        // on any event...
        watcher.on('all', (...args) => {
            // pass it through to our listener
            exportedWatcher.emit(args[0], ...args);
            exportedWatcher.emit('all', ...args);
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
        console.error(watched, readyPaths);
    });

    // send errors out
    watcher.on('error', (...args) => exportedWatcher.emit('error', ...args));
 
    exportedWatcher.close = () => {
        watcher.close();
    };

    return exportedWatcher;
}
