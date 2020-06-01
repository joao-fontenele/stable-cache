import { IPolicy } from 'cockatiel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare type PolicyLike = IPolicy<any>

/**
 * Base policy class
 */
export class MyPolicy {
  policy: PolicyLike;

  getPolicy(): PolicyLike {
    return this.policy;
  }
}
