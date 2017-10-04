const request = require('request');

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

const initProxyAPIs = (config) => {
    const proxyPatterns = Object.keys(config.proxyAPIs || {})
        .filter((k) => {
            return !!(k[0] === '/');
        })
        .sort()
        .map((src) => ({
            pattern: new RegExp(`^${src}`),
            template: config.proxyAPIs[src]
        }));

    return (req, res, info) => {
        const { pattern, template } = matchProxy(req.url, proxyPatterns);
        // TODO: consider supporting template objects as well with
        // 'url' as the url template and other properties as options
        // to request(). Substitutions would need to be supported
        // more generally.
        if (pattern && template && typeof template === 'string') {
            const dest = req.url.replace(pattern, template);
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

        return;
    };
};

module.exports = initProxyAPIs;