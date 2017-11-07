/*
Watch mock directories for changes. When they occur, update the mocks object.
Return a promise that resolves with a getter function when the mock object
is initialized.
*/
const path = require('path');
const fs = require('fs');
const globParent = require('glob-parent');
const mime = require('mime');
const mayRequire = require('may-require');
const unixify = require('unixify');

const tryReloadRequire = mayRequire({
    reload: true
});

const resolveRelativePath = (fsRoots, absPath, index = 0) => {
    const root = fsRoots[index];
    const relPath = path.posix.relative(root, absPath);
    if (!/\.\./.test(relPath)) {
        return [root, path.posix.join('/', relPath)];
    }
    return (fsRoots.length - 1) <= index ?
        absPath : 
        resolveRelativePath(fsRoots, absPath, index + 1);
};

function initMockFunctions(mockObjects, mockGlobs) {
    const fsRoots = mockGlobs
        // don't use exclusions to calculate root paths
        .filter((glob) => glob[0] != '!')
        // get the glob parent
        .map(globParent);
    
    const fsRootMap = {};
    const fsMocks = fsRoots.reduce((prevFsMocks, rootPath) => {
        fsRootMap[rootPath] = Object.create(prevFsMocks);
        return fsRootMap[rootPath];
    }, {});

    const mocks = Object.create(fsMocks);

    // set predefined mock objects directly on the mocks object,
    // so they take precedence over file system mocks
    mockObjects.forEach((obj) => {
        const k = obj.path;
        const v = Object.assign(obj.mock);
        mocks[k] = v;
    });

    return {
        getMock: (forPath) => {
            return mocks[forPath];
        },
        setMock: (absolutePath, toSet) => {
            const [root, forPath] = resolveRelativePath(fsRoots, absolutePath);
            const rootMocks = fsRootMap[root];
            const possibleDir = (path.extname(forPath) === '');
            if (!toSet) {
                delete rootMocks[forPath];
                if (possibleDir) {
                    delete rootMocks[`${forPath}/`];
                }
                return;
            }
            const mock = (Buffer.isBuffer(toSet) || typeof toSet === 'string') ? {
                request: {
                    method: 'GET'
                },
                response: {
                    /*
                    TODO: build up more metadata here,
                    including response headers, etc.
                    */
                    headers: {
                        'content-type': mime.getType(forPath)
                    },
                    body: toSet
                }
            } : toSet;

            rootMocks[forPath] = mock;
            if (possibleDir) {
                rootMocks[`${forPath}/`] = mock;
            }
        }
    }
}

function toAbsolute(aPath) {
    const posixPath = unixify(aPath);
    return path.posix.isAbsolute(posixPath) ? posixPath : path.posix.join(
        unixify(process.cwd()),
        posixPath
    );
}

function getMockLoader(setMock) {
    return function reloadMock (event, updatedPath) {
        const mockPath = toAbsolute(updatedPath);
        /*
        TODO: debounce this, because multiple events fire when a file is changed
        */
        // regardless of what happened, if we got a path
        // try reloading it.
        let [err, aMock] = tryReloadRequire(mockPath);

        if (!err && aMock) {
            setMock(mockPath, aMock);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            /*
            Not able to require(), but file might exist...
            */
            fs.readFile(mockPath, (er2, data) => {
                if (er2) {
                    // remove any previous mock from the cache
                    setMock(mockPath);
                    return resolve();
                };

                setMock(mockPath, data);
                return resolve();
            });
        });
    };
}



function watchMockDirectories (config) {
    const { mockObjects, mockGlobs } = config.mocks
        .reduce((sorted, item) => {
            if ('string' !== typeof item) {
                // this will go stright in mocks
                sorted.mockObjects.push(item);
            } else {
                sorted.mockGlobs.push(toAbsolute(item));
            }
            return sorted;
        }, { mockObjects: [], mockGlobs: [] });

    config.emit('mock-globs', mockGlobs);
    const {
        getMock,
        setMock
    } = initMockFunctions(mockObjects, mockGlobs);
    const reloadMock = getMockLoader(setMock);

    const promises = [];
    if (mockGlobs.length > 0) {
        const watcher = (config.watch || require('./watchers/no-watcher'))(mockGlobs);

        promises.push(new Promise((resolve, reject) => {
            watcher.on('ready', () => { resolve(); });    
        }));

        const updateMock = (event, filepath) => {
            const p = reloadMock(event, filepath)
            .then(() => {
                config.emit('mock-updated', filepath);
            });

            // if we have not declared we are loaded and
            // emptied the promises array, add this one
            // so we wait for it to resolve.
            if (promises[0]) {
                promises.push(p);    
            }
        };
        watcher.on('all', updateMock);

        watcher.on('error', (error) => {
            config.emit('error', error);
        });

        config.on('_shutdown', () => {
            watcher.close();
        });
    }

    return Promise.resolve()
        // wait for the `ready` promise first 
        // (this will be `undefined` if we have no mockGlobs
        // and resolve immediately)
        .then(() => promises[0])
        // then make sure all the other promises that got created
        // by files being marked for update by the watcher got resolved too
        .then(() => Promise.all(promises))
        .then(() => {
            // stop collecting promises
            promises.length = 0;

            config.emit('loaded');
            /* Only provide a getter */
            return {
                config,
                getMock
            };
        });
}

module.exports = watchMockDirectories;
