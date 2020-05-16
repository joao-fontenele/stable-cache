class MyPolicy {
  getPolicy() {
    return this.policy;
  }

  execute(fn) {
    return this.policy.execute(fn);
  }

  cleanupListeners() {
    return (this.listeners || [])
      .map((listener) => listener.dispose());
  }
}

module.exports = MyPolicy;
