function getDelay(header) {
    let d;
    try {
        d = parseInt(header);
    } catch (error) {
        // ignore
    }
    return d || 250;
}

module.exports = function ({ request: req, response: res }) {
    setTimeout(() => {
        res.statusCode = req.headers['x-echo-status'] || 200;
        res.write(`${req.method} ${req.url}\n`)
        res.write(JSON.stringify(req.headers, null, 2));
        res.write('\n\n');

        req.pipe(res);
    }, getDelay(req.headers['x-echo-delay']));
}