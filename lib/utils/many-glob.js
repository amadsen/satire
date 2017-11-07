const klaw = require('klaw');
const unixify = require('unixify');
const mm = require('micromatch');
const globParent = require('glob-parent');

function micromatcher (file, globs) {
  return mm([unixify(file)], [].concat(globs)).length > 0;
}

function deduplicate(list) {
  const found = list.reduce(
    (set, item) => {
      // deduplicate the paths
      if (!set.flags[item]) {
        set.flags = true;
        set.list.push(item);
      }
      return set;
    },
    { list: [], flags: {} }
  ).list;
  return found;
}

function makeManyGlob(matcher = micromatcher) {
  function findPaths(root, globs) {
    return new Promise((resolve, reject) => {
      const paths = [];
      let done = false;
      let finish = (fn, arg) => {
        if (!done) {
          done = true;
          fn(arg);
        }
      }
  
      klaw(root)
      .on('error', (err) => {
        // it should be ok if the root does not exist
        if(err.code === 'ENOENT' && err.path === root) {
          finish(resolve, []);
          return;
        }
        finish(reject, err);
      })
      .on('data', (item) => {
        if (!matcher(item.path, globs)) {
          return;
        }
        paths.push(item.path)
      })
      .on('end', () => {
        finish(resolve, paths);
      })
    });
  }

  function resolveGlobs(providedGlobs) {
    const globs = [].concat(providedGlobs);
    /*
    It might be possible to further focus the glob patterns
    on just a specific subset of directories by doing brace
    expansion, etc., but for now this should do.
    */
    const parents = deduplicate(
      // deduplicate parents
      globs
      // don't use exclusions to calculate root paths
      .filter((glob) => glob[0] != '!')
      // get the glob parent
      .map(globParent)
    );

    return Promise.all(
      parents.map((root) => findPaths(root, globs))
    ).then((pathSets) => deduplicate([].concat(...pathSets)));
  }
  resolveGlobs.matcher = matcher;

  return resolveGlobs;
}

module.exports = makeManyGlob;
