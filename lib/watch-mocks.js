/*
Watch mock directories for changes. When they occur, update the mocks object.
Return a promise that resolves with a getter function when the mock object
is initialized.
*/
const path = require('path');
const fs = require('fs');
const sane = require('sane');
const globby = require('globby');
const globParent = require('glob-parent');
const mime = require('mime');

const tryReloadRequire = (id) => {
    try {
        delete require.cache[require.resolve(id)];
        return [null, require(id)];
    } catch(e) {
        return [e];
    }
};

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
        },
        mockCount: () => {
            let count = 0;
            for (let k in mocks) {
                count++
            }
            return count;
        }
    }
}

function toPosixPath(aPath) {
    if (path.posix.sep === path.sep) {
        // we have a posix filesystem - no path manipulation needed
        return aPath;
    }
    return path.posix.join.apply(
        path.posix,
        aPath.split(path.sep)
    ).replace(/^([a-z]+:)?\//i, '/');
}
function toAbsolute(aPath) {
    const posixPath = toPosixPath(aPath);
    return path.posix.isAbsolute(posixPath) ? posixPath : path.posix.join(
        toPosixPath(process.cwd()),
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

function watchMockDirectories (config) {
    const { mockObjects, mockGlobs } = config.mocks
        .reduce((sorted, item) => {
            if ('string' !== typeof item) {
                if (item && item.path && item.mock) {
                    // this will go stright in mocks
                    sorted.mockObjects.push(item);
                }
            } else {
                sorted.mockGlobs.push(toAbsolute(item));
            }
            return sorted;
        }, { mockObjects: [], mockGlobs: [] });

    config.emit('mock-globs', mockGlobs);
    const {
        getMock,
        setMock,
        mockCount
    } = initMockFunctions(mockObjects, mockGlobs);
    const reloadMock = getMockLoader(setMock);

    if (mockGlobs.length < 1 && mockCount() < 1) {
        return Promise.reject(new Error('No valid mocks provided'));
    }

    const promises = [];
    if (config.watch && mockGlobs.length > 0) {
        const {
            root,
            globs
        } = sharedFsRoot(mockGlobs);

        const watcher = sane(root, {
            glob: globs
        })
        .on('error', (error) => {
            config.emit('error', error);
        });

        const updateMock = (event, filepath, root, stat) => {
            reloadMock(event, filepath)
            .then(() => {
                config.emit('mock-updated', path.join(root, filepath));
            });
        };

        watcher.on('add', updateMock.bind(null, 'add'));
        watcher.on('change', updateMock.bind(null, 'change'));
        watcher.on('delete', updateMock.bind(null, 'delete'));

        promises.push(new Promise((resolve, reject) => {
            watcher.on('ready', () => { resolve(); });    
        }));

        config.on('_shutdown', () => {
            watcher.close();
        });
    }

    return globby(mockGlobs)
        .then((paths) => Promise.all(
            paths.map((mockPath) => reloadMock('init', mockPath))
        ))
        .then(() => promises[0])
        .then(() => {
            config.emit('loaded');
            /* Only provide a getter */
            return {
                config,
                getMock
            };
        });
}

module.exports = watchMockDirectories;
