import { expect } from 'chai';

export async function expectToThrow(
  promise: Promise<any>,
  expectedError?: Error,
): Promise<Error|undefined> {
  let error: Error | undefined;

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
}
