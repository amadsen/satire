const request = require('request');
const type = require('type-of');
const trike = require('trike');
const mayRequire = require('may-require');

const matchProxy = (url, proxies, idx) => {
    const i = idx || 0;
    if (i >= proxies.length) {
        return {};
    }
    const p = proxies[i];
    
    if(p.pattern.test(url)) {
        return p;
    }

    return matchProxy(url, proxies, i + 1);
}

const proxyTemplateHandlers = {
    'function': (fn) => (pattern, req) => fn(pattern, req),
    'string': (template) => (pattern, req) => ({
        url: req.url.replace(pattern, template)
    }),
    'object': (obj, from) => {
        if (obj.module) {
            const [err, mod] = mayRequire({ from })(obj.module);
            if (err) {
                throw err;
            }
            const definition = mod(obj);
            return proxyTemplateHandlers[type(definition)](definition, from);
        }
    }
};

const initProxyAPIs = (config) => {
    const proxyPatterns = Object.keys(config.proxyAPIs || {})
        .filter((k) => {
            return !!(k[0] === '/');
        })
        .sort()
        .map((src) => {
            const definition = config.proxyAPIs[src];
            const [err, proxyFn] = trike(
                proxyTemplateHandlers[type(definition)],
                definition,
                config.from
            );
            if (!proxyFn) {
                throw new Error(`Invalid proxy API definition: ${definition}`);
            }

            return {
                pattern: new RegExp(`^${src}`),
                proxyFn
            };
        });

    return (info, { request: req, response: res }) => {
        const { pattern, proxyFn } = matchProxy(req.url, proxyPatterns);

        if (pattern && proxyFn) {
            const urlParams = [];
            // cheating to use string.replace to parse the url
            req.url.replace(pattern, (...args) => {
                args.slice(1, -2).forEach((item) => urlParams.push(item));
            });

            const dest = proxyFn(pattern, req, urlParams);
            const r = request(dest);
            r.on('response', (response) => {
                res.emit('proxy-response', {
                    correlationId: info.correlationId,
                    req,
                    res: response
                });
            })
            req.pipe(r).pipe(res);

            return []; // an empty array indicates the request has been handled
        }

        return ['next'];
    };
};

module.exports = initProxyAPIs;