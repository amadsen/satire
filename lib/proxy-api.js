const request = require('request');
const type = require('type-of');

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

const query = (src, keys) => {
    if (typeof src === 'undefined' || keys.length < 1) {
        return src;
    }
    return query(src[keys[0]], keys.slice(1));
};

const substitutionHandlers = {
    'object': (substitutions, template, src, fromUrl) => {
        return Object.keys(template).reduce(
            (target, k) => {
                target[k] = substitutions(template[k], src, fromUrl);
                return target;
            },
            {}
        );
    },
    'array': (substitutions, template, src, fromUrl) => {
        template.map((item, idx) => substitutions(item, src, fromUrl));
        return target;
    },
    'string': (substitutions, template, src, fromUrl) => {
        return template
            .replace(/\$\{([a-z][.\w]+)\}/gi, (match, key) => {
                return query(src, key.split('.'));
            })
            .replace(/\$(\d+)/gi, (match, key) => {
                return fromUrl[Number(key)];
            });
    }
};

const substitutions = (template, src, urlParams = []) => {
    const t = type(template);
    const fn = substitutionHandlers[t] || (() => template);

    return fn(substitutions, template, src, fromUrl);
};

const proxyTemplateHandlers = {
    'function': (template, ...args) => template(...args),
    'object': (template, pattern, src, fromUrl) => substitutions(template, src, fromUrl),
    /*
    TODO: fix match not being passed to the substitution fn
    */
    'string': (template, ...args) => proxyTemplateHandlers.object({ url: template }, ...args)
};

const initProxyAPIs = (config) => {
    const proxyPatterns = Object.keys(config.proxyAPIs || {})
        .filter((k) => {
            return !!(k[0] === '/');
        })
        .sort()
        .map((src) => {
            const definition = config.proxyAPIs[src];
            const proxyFn = proxyTemplateHandlers[type(definition)];
            if (!proxyTemplateFn) {
                throw new Error(`Invalid proxy API definition: ${definition}`);
            }

            return {
                pattern: new RegExp(`^${src}`),
                proxyFn: proxyFn.bind(null, template)
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