/*
Watch mock directories for changes. When they occur, update the mocks object.
Return a promise that resolves with a getter function when the mock object
is initialized.
*/
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const globby = require('globby');
const globParent = require('glob-parent');

const tryRequire = (id, req) => {
    const _req = req || require;
    try {
        return [null, req(id)];
    } catch(e) {
        return [e];
    }
};

const resolveRelativePath = (fsRoots, absPath, index = 0) => {
    const root = fsRoots[index];
    const relPath = path.relative(root, absPath);
    if (!/\.\./.test(relPath)) {
        return [root, path.posix.join('/', relPath)];
    }
    return fsRoots.length < index ?
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
        const v = Object.assign(obj);
        delete v.path;
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
                    body: toSet
                }
            } : toSet;

            rootMocks[forPath] = mock;
            if (possibleDir) {
                rootMocks[`${forPath}/`] = mock;
            }
        },
        mockCount: () => Object.keys(mocks).length + Object.keys(fsMocks).length
    }
}


function getMockLoader(logger, setMock) {
    return function reloadMock (event, updatedPath) {
        /*
        TODO: debounce this, because multiple events fire when a file is changed
        */
        // regardless of what happened, if we got a path
        // try reloading it.
        // first clear the require cache
        delete require.cache[updatedPath];
        let [err, aMock] = tryRequire(updatedPath, require);

        //logger.log(`Tried ${updatedPath}`, err, aMock);

        if (!err && aMock) {
            // TODO: fix path storage and/or matching for windows
            setMock(updatedPath, aMock);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            /*
            Not able to require(), but file might exist...
            */
            fs.readFile(updatedPath, (er2, data) => {
                if (er2) {
                    // logger.error(`Unable to read mock at ${updatedPath}`);
                    // logger.error(err);
                    // logger.error(er2);

                    // remove any previous mock from the cache
                    setMock(updatedPath);
                    return resolve();
                };
                // TODO: fix path storage and/or matching for windows
                setMock(updatedPath, data);
                return resolve();
            });
        });
    };
}

function toAbsolute(aPath) {
    return path.isAbsolute(aPath) ? aPath : path.posix.join(
        process.cwd(),
        aPath
    );
}

function watchMockDirectories (config) {
    const { logger } = config;
    const { mockObjects, mockGlobs } = [].concat(config.mocks)
        .reduce((sorted, item) => {
            if ('string' !== typeof item) {
                if (item && item.path) {
                    // this will go stright in mocks
                    sorted.mockObjects.push(item);
                }
            } else {
                sorted.mockGlobs.push(toAbsolute(item));
            }
            return sorted;
        }, { mockObjects: [], mockGlobs: [] });

    logger.log('Mock Globs:', mockGlobs);
    const {
        getMock,
        setMock,
        mockCount
    } = initMockFunctions(mockObjects, mockGlobs);
    const reloadMock = getMockLoader(logger, setMock);

    if(mockGlobs.length < 1 && mockCount() < 1) {
        return Promise.reject(new Error('No valid mocks provided'));
    }

    const watcher = chokidar.watch(
        mockGlobs,
        {
            ignoreInitial: true
        }
    )
    .on('error', (error) => {
        logger.error(error);
    })
    .on('all', reloadMock);

    return globby(mockGlobs)
        .then((paths) => Promise.all(
            paths.map((mockPath) => reloadMock('init', mockPath))
        ))
        .then(() => {
            /* Only provide a getter */
            return {
                config,
                getMock
            };
        })
        .catch((err) => {
            console.error('Error initializing mocks:', err);
            return Promise.reject(err);
        });
}

module.exports = watchMockDirectories;
