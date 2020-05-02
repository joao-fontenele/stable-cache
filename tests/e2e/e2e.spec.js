const main = require('../../lib');

describe('end 2 end', function () {
  it('should work', function () {
    const result = main.sum(1, 2);
    const expected = 3;

    expect(result).to.equal(expected);
  });
});
