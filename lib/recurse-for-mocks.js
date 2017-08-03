const path = require('path');

const recurseForMocks = (getMock, pathname) => (
    [].concat(
        (pathname === '/') ? [] : recurseForMocks(
            getMock, 
            path.join(pathname, '..')
        ),
        { 
            mock: getMock(pathname),
            path: pathname
        } 
    ).filter((m) => !!m)
);

module.exports = recurseForMocks