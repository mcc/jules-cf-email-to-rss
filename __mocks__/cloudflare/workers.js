// __mocks__/cloudflare/workers.js

// Mock DurableObject class
export class DurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // Add any methods that are called on DurableObject instances in your tests
  // For example, if your DOs use this.state.storage.get(), you might need to mock that.
  // For basic instantiation, this constructor might be enough.
}

// Mock any other exports from 'cloudflare:workers' that your code might use.
// For example, if you use `fetchMock` or other utilities:
// export const fetchMock = vi.fn();

// If there are other specific named exports, mock them as needed:
// export const SomeOtherExport = {};

// Default export if needed (less common for 'cloudflare:workers' which usually has named exports)
// export default {};
