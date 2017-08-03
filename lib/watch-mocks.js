/*
Watch mock directories for changes. When they occur, update the mocks object.
Return a promise that resolves with a getter function when the mock object
is initialized.
*/
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const tryRequire = require('try-require');

function getMock (mocks, forPath) {
    return mocks[forPath];
}

function watchMockDirectories (config) {
    const logger = (config.logger || console);

    return new Promise( (resolve, reject) => {
        let resolved = false;
        const mocks = {};
        const mockGlobs = [].concat(config.mocks)
            .map((glob) => {
                if ('string' !== typeof glob) {
                    if (glob && glob.path) {
                        // just put it stright in mocks
                        mocks[glob.path] = glob.mock;
                    }
                    return null;
                }
                return path.isAbsolute(glob)?
                    glob :
                    path.posix.join(process.cwd(), glob);
            })
            .filter((glob) => !!glob);

        if(mockGlobs.length < 1 && Object.keys(mocks).length < 1) {
            return reject(new Error('No valid mocks provided'));
        }

        const watcher = chokidar.watch(
            mockGlobs,
            {
                ignored: /(^|[\/\\])\../,
                cwd: process.cwd()
            }
        )
        .on('error', (error) => {
            if (!resolved) {
                resolved = true;
                return reject(error);
            }
            logger.error(error);
        })
        .on('all', (event, updatedPath) => {
            /*
            TODO: debounce this, because multiple events fire when a file is changed
            */
            // regardless of what happened, if we got a path
            // try reloading it.
            // first clear the require cache
            delete require.cache[require.resolve(updatedPath)];
            let aMock = tryRequire(updatedPath, require);

            if(aMock){
                mocks[updatedPath] = aMock;
            } else {
                let err = tryRequire.lastError();
                if (err.code !== "MODULE_NOT_FOUND") {
                    /*
                    Not able to require(), but file exists...
                    */
                    fs.readFile(updatedPath, (er2, data) => {
                        if (er2) {
                            logger.error(`Unable to read mock at ${updatedPath}`);
                            logger.error(err);
                            logger.error(er2);
                            return;
                        };
                        /*
                        TODO: build up more metadata here, including response headers, etc.
                        */
                        mocks[updatedPath] = {
                            request: {
                                method: 'GET'
                            },
                            response: {
                                body: data
                            }
                        };
                    });
                } else {
                    // remove any previous mock from the cache
                    delete mocks[updatedPath];
                }
            }
        });


        watcher.on('ready', () => {
            /* Only provide a getter */
            resolved = true;
            resolve({ 
                config,
                getMock: getMock.bind(null, mocks)
            });
        });

    });
}

module.exports = watchMockDirectories;
