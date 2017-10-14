const send404 = ({ response: res }) => {
    res.statusCode = 404;
    res.end('Not Found');
    return ['404'];
};

module.exports = send404;