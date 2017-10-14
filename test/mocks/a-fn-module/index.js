module.exports = function ({ request: req, response: res }) {
    res.write('a function module');
    res.end();
};