const main = require('../../lib');

describe('sample unit', function () {
  it('should work', function () {
    expect(true).to.not.be.false;

    const result = main.sum(1, 2);
    const expected = 3;

    expect(result).to.equal(expected);
  });
});
