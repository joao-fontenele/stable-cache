import { IPolicy } from 'cockatiel';
/**
 * Base policy class
 */
export class MyPolicy {
  policy: IPolicy<any>;

  getPolicy() {
    return this.policy;
  }
}
