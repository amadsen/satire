const path = require('path');

const recurseForMocks = (getMock, pathname) => {
    const nextPathname = path.posix.join(pathname, '..');
    return [].concat(
        (pathname === nextPathname) ? [] : recurseForMocks(
            getMock, 
            nextPathname
        ),
        [].concat(getMock(pathname)).map((m) => ({ 
            mock: m,
            location: pathname
        }))
    ).filter((m) => (m && m.mock))
};

module.exports = recurseForMocks