const Utils = {
  async expectToThrow(promise, expectedError) {
    let error;

    try {
      await promise;
    } catch (err) {
      error = err;
    }

    expect(error).to.not.be.undefined;

    if (expectedError) {
      expect(error).to.be.eql(expectedError);
    }

    return error;
  },
};

module.exports = Utils;
