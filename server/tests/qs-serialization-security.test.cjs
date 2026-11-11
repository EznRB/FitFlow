const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const qs = createRequire(require.resolve('express/package.json'))('qs');

test('resolved qs handles JSON and null-prototype elements in comma arrays without crashing', () => {
  const inputs = [JSON.parse('{"a":[{"toString":"x"}]}'), { a: [Object.assign(Object.create(null), { b: 'c' })] }];
  for (const input of inputs) for (const encodeValuesOnly of [false, true]) {
    let result;
    assert.doesNotThrow(() => { result = qs.stringify(input, { arrayFormat: 'comma', encodeValuesOnly }); });
    assert.equal(typeof result, 'string');
    assert.ok(result.startsWith('a='));
  }
});

test('resolved qs preserves ordinary serialization and default array query parsing', () => {
  assert.equal(qs.stringify({ a: ['x', 'y'] }, { arrayFormat: 'comma' }), 'a=x%2Cy');
  assert.equal(qs.stringify({ a: ['x', 'y'] }), 'a%5B0%5D=x&a%5B1%5D=y');
  assert.deepEqual(qs.parse('a%5B0%5D=x&a%5B1%5D=y'), { a: ['x', 'y'] });
});
