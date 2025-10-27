/**
 * Smoke test for EventPublisherService
 */

describe('EventPublisherService Smoke Test', () => {
  it('should load the module', () => {
    expect(() => {
      require('../EventPublisherService');
    }).not.toThrow();
  });
});
