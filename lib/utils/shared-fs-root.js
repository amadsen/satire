const path = require('path');

function sharedFsRoot(mockGlobs) {
  const fsRoot = path.parse(process.cwd()).root;
  const globs = [].concat(mockGlobs);
  const rootParts = globs
      .reduce((shared, aGlob) => {
          const parts = aGlob.split(path.posix.sep);
          if (shared) {
              let done = false;
              return shared.reduce((same, segment, i) => {
                  if (!done && segment === parts[i]) {
                      same.push(segment);
                  } else {
                      done = true;
                  }
                  return same;
              }, []);
          }
          return parts;
      }, null);

  const root = path.normalize(path.join(fsRoot, ...rootParts));
  return {
      root,
      globs: globs.map((g) => path.relative(root, g))
  };
}

module.exports = sharedFsRoot;
