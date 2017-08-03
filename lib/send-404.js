const send404 = (res) => {
    res.statusCode = 404;
    res.end('Not Found');
};

module.exports = send404;