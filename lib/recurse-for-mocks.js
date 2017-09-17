const path = require('path');

const recurseForMocks = (getMock, pathname) => {
    const nextPathname = path.posix.join(pathname, '..');
    return [].concat(
        (pathname === nextPathname) ? [] : recurseForMocks(
            getMock, 
            nextPathname
        ),
        { 
            mock: getMock(pathname),
            path: pathname
        }
    ).filter((m) => (m && m.mock))
};

module.exports = recurseForMocks