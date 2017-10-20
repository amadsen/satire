const type = require('type-of');

const matchers = {
    // types not otherwise specified use ===
    '_default': (predicate, target) => (predicate === target),
    // Regular Expressions use regExp.test()
    'regexp': (predicate, target) => predicate.test(target),
    // Functions should return true or false
    'function': (predicate, target) => predicate(target),
    // descend in to objects
    'object': (predicate, target) => (
        Object.keys(predicate).every((k) => matches(predicate[k], target[k]))
    ),
    // All items in an Array must match
    'array': (predicate, target) => (
        predicate.every((item) => matches(item, target))
    )
}

const matches = (predicate, target) => {
    const t = type(predicate);
    let fn = matchers[t];
    // predicate types without a specific definition use ===
    if (type(fn) !== 'function') {
        fn = matchers._default;
    }
    const r = fn(predicate, target);
    return r;
};

const matchProps = (predicate, raw, url) => {
    const withUrl = Object.create(raw);
    withUrl.url = url;
    /*
    TODO: implement non-destructively matching on the request body
    */

    const toMatch = [raw, withUrl];
    return toMatch.some((target) => matches(predicate, target))
};

module.exports = matchProps;
