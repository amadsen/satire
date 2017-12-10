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
const stable = require('stable');

const tryReloadRequire = mayRequire({
  reload: true
});

const resolveRelativePath = (fsRoots, absPath, index = 0) => {
  const root = fsRoots[index];
  const relPath = path.posix.relative(root, absPath);
  if (!/\.\./.test(relPath)) {
    return [index, path.posix.join('/', relPath)];
  }
  return (fsRoots.length - 1) <= index ?
    [index, absPath] :
    resolveRelativePath(fsRoots, absPath, index + 1);
};

const setMockForPath = (mocks, forPath, toSet) => {
  // ensure there is an entry for the path
  let list = (mocks[forPath] || []);
  
  // remove old entries for this absolute path
  list = list.filter((mockEntry) => {
    return mockEntry.sourcePath !== toSet.sourcePath;
  });

  // add new entry for this absolute path
  if (toSet.mock) {
    list.push(toSet);
  }

  // clean up empty url paths
  if (list.length === 0) {
    delete mocks[forPath];
  } else {
    // sort the list and store it
    mocks[forPath] = stable(list, (a, b) => {
      // we are going to do some sorting here according to:
      return [
        // file system root index - the higher the index, the lower the priority
        () => b.root - a.root,
        // source path - ends with .json
        () => [a, b].map(({ sourcePath }) => /\.json$/.test(sourcePath) ? 1 : 0)
          .reduce((a, b) => {
            return b - a;
          }),
        () => a.localeCompare(b, 'en', {
          numeric: true,
          caseFirst: 'upper'
        })
      ].reduce((r, fn) => {
        if (r !== 0) {
          return r;
        }
        return fn();
      }, 0);
    });
  }
}

function initMockFunctions(mockObjects, mockGlobs) {
  const fsRoots = mockGlobs
    // don't use exclusions to calculate root paths
    .filter((glob) => glob[0] != '!')
    // get the glob parent
    .map(globParent);

  const mocks = {};

  const setMock = (absolutePath, newMock) => {
    const [root, forPath] = resolveRelativePath(fsRoots, absolutePath);

    // if it is a json file or does not have an extension, it should
    // possibly represent a directory with or without a trailing /
    const possibleDir = (path.extname(forPath) === '' || /\.json$/.test(forPath));
    const dirPath = !possibleDir ? null : forPath.replace(/\.json$/, '');

    const mock = (Buffer.isBuffer(newMock) || typeof newMock === 'string') ? {
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
        body: newMock
      }
    } : newMock;

    const toSet = {
      sourcePath: absolutePath,
      mock,
      root
    }

    setMockForPath(mocks, forPath, toSet);
    if (dirPath) {
      setMockForPath(mocks, dirPath, toSet);
      setMockForPath(mocks, `${dirPath}/`, toSet);
    }
  };

  // add mockObjects to mocks with highest priority sort order
  mockObjects.forEach((obj) => {
    setMockForPath(mocks, obj.path, { mock: obj.mock });
  });

  return {
    getMock: (forPath) => {
      // flatten and this array to only return mocks
      return (mocks[forPath] || []).reduce((list, mockEntry) => {
        return list.concat(mockEntry.mock);
      }, []);
    },
    setMock
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
        return new Promise((resolve, reject) => {
          fs.lstat(mockPath, (e, stat) => {
            let [err, aMock] = tryReloadRequire(
              // we need to prefer directories over the .js, .json, and .node files
              // that `require()` would prioritize if they exist.
              mockPath + (stat && stat.isDirectory() ? '/' : '')
            );
            
            if (!err && aMock) {
              setMock(mockPath, aMock);
              return resolve();
            }
          
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
