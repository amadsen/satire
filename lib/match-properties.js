const type = require('type-of');

const matchers = {
    // match on strings ===, regExp.test(), function() === true
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
    const fn = matchers[type(predicate)];
    // predicate types without a specific definition use ===
    if (type(fn) !== 'function') {
        fn = matchers._default;
    }
    return fn(predicate, target);
};

const matchProps = (predicate, ...toMatch) => (
    // For each key in the list...
    toMatch.every((target) => matches(predicate, target))
);

module.exports = matchProps;
