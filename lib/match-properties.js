const type = require('type-of');

const matchers = {
    // types not otherwise specified use ===, regExp.test(), function() === true
    // descend in to objects
    '_default': (predicate, target) => (predicate === target),
    'regexp': (predicate, target) => predicate.test(target),
    'function': (predicate, target) => predicate(target),
    'object': (predicate, target) => (
        Object.keys(predicate).every((k) => matches(predicate[k], target[k]))
    ),
    'array': (predicate, target) => (
        predicate.every((item, i) => matches(item, target[i]))
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

    const toMatch = [raw, withUrl];
    return toMatch.some((target) => matches(predicate, target))
};

module.exports = matchProps;
