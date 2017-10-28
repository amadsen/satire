const callsites = require('callsites');
const path = require('path');

const getCallingFile = ({ dir, ignore }) => {
    const sites = callsites();
    const ignoredPaths = [].concat(ignore, __filename);
    
    for (let i = 0, l = sites.length, askingFile; i < l; i++) {
        // get the filename for the call site
        const siteFilename = sites[i].getFileName();

        // ignore if we call ourself or if we match any of the ignored file names
        if (ignoredPaths.indexOf(siteFilename) === -1) {
            // skip the file that called us too - it wants to know what called it
            if (!askingFile) {
                askingFile = siteFilename;
            }

            // this should be the one we want (unless some callback logic is in effect)
            if (siteFilename !== askingFile) {
                return dir ? path.dirname(siteFilename) : siteFilename;
            }
        }
    }
    
    // explicitly returns undefined if no calling file is found
};

module.exports = getCallingFile
