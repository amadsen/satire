const path = require('path');

function initProxyFunction (opts) {
  // console.log('Initializing function proxy with opts:', opts);
  return function proxyFunction(pattern, req) {
    // console.log('Calling function proxy:', pattern, req.url);
    const prefix = (req.headers['x-proxy-prefix'] || '');
    // console.log(prefix);
    const dest = {
      url: req.url
        .replace(pattern, opts.template || '')
        .replace(
          /^(http(s)?:\/\/[^/]+\/)(.*)$/,
          (m, host, s, theRest) => {
            // console.log(m, host, theRest);
            return `${host}${theRest ? path.posix.join(prefix, theRest) : prefix}`
          }
        )
    };
    // console.log(dest); 
    return dest;
  };
}

module.exports = initProxyFunction;
