const resolveFrom = require('resolve-from');
const callingFile = require('./calling-file.js');

const trike = (fn, ...args) => {
    try {
        return [null, fn(...args)];
    } catch(e) {
        return [e];
    }
}

const mayRequire = (opts, ...args) => {
    if ('string' === typeof opts) {
        return mayRequire({})(opts, ...args);
    }

    if (args.length > 0) {
        return mayRequire(opts)(...args);
    }

    const _req = opts.require || require;
    const from = opts.from || callingFile({ dir: true });

    return (moduleId) => {        
        const [err, id] = trike(resolveFrom, from, moduleId);
        if (err) {
            return [err];
        }

        const stash = _req.cache[id];
        if (opts.reload) {
            delete _req.cache[id];            
        }
        const moduleResult = trike(_req, id);
        if (opts.reload && stash) {
            _req.cache[id] = stash;            
        }
        return moduleResult;
    };
};

module.exports = mayRequire;
