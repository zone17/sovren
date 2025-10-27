/**
 * 🏭 **ELITE TEST DATA FACTORIES**
 *
 * **Purpose**: Comprehensive test data generation with realistic, consistent data
 * **Architecture**: Factory pattern for all domain entities
 * **Security**: Safe test data that doesn't expose real information
 * **Performance**: Fast data generation for test execution
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

// 🎯 **SIMPLE MOCK DATA GENERATOR (FAKER ALTERNATIVE)**
class SimpleFaker {
  private static seed = 12345;

  static setSeed(newSeed: number): void {
    this.seed = newSeed;
  }

  private static random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  static uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (SimpleFaker.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static email(): string {
    const domains = ['test.com', 'example.com', 'mock.org'];
    const names = ['john', 'jane', 'bob', 'alice', 'charlie'];
    return `${this.arrayElement(names)}${Math.floor(this.random() * 1000)}@${this.arrayElement(domains)}`;
  }

  static userName(): string {
    const names = ['testuser', 'mockuser', 'demouser', 'sampleuser'];
    return `${this.arrayElement(names)}${Math.floor(this.random() * 1000)}`;
  }

  static fullName(): string {
    const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie'];
    const lastNames = ['Doe', 'Smith', 'Johnson', 'Brown', 'Davis'];
    return `${this.arrayElement(firstNames)} ${this.arrayElement(lastNames)}`;
  }

  static sentence(): string {
    const sentences = [
      'This is a test sentence.',
      'Sample content for testing.',
      'Mock data for development.',
      'Example text content.',
    ];
    return this.arrayElement(sentences);
  }

  static paragraph(): string {
    return 'This is a test paragraph with sample content for testing purposes. It contains multiple sentences to simulate real content.';
  }

  static arrayElement<T>(array: T[]): T {
    const index = Math.floor(this.random() * array.length);
    return array[index];
  }

  static number(min: number = 0, max: number = 100): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  static boolean(): boolean {
    return this.random() > 0.5;
  }

  static pastDate(): string {
    const now = Date.now();
    const pastTime = now - this.number(1, 365) * 24 * 60 * 60 * 1000;
    return new Date(pastTime).toISOString();
  }

  static recentDate(): string {
    const now = Date.now();
    const recentTime = now - this.number(1, 7) * 24 * 60 * 60 * 1000;
    return new Date(recentTime).toISOString();
  }
}

// 🎯 **TYPE DEFINITIONS**
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: 'creator' | 'supporter' | 'admin';
  createdAt: string;
  updatedAt: string;
  verified: boolean;
}

export interface Content {
  id: string;
  title: string;
  body: string;
  authorId: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  viewCount: number;
  likeCount: number;
}

export interface Analytics {
  id: string;
  userId: string;
  period: '24h' | '7d' | '30d' | '90d';
  totalEngagement: number;
  engagementRate: number;
  generatedAt: string;
}

export interface Payment {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

// 🏭 **FACTORY CONFIGURATION**
interface FactoryOptions {
  overrides?: Partial<any>;
}

// 🧑 **USER FACTORY**
export class UserFactory {
  static create(options: FactoryOptions = {}): User {
    const { overrides = {} } = options;

    const baseUser: User = {
      id: SimpleFaker.uuid(),
      email: SimpleFaker.email(),
      username: SimpleFaker.userName(),
      displayName: SimpleFaker.fullName(),
      role: SimpleFaker.arrayElement(['creator', 'supporter', 'admin']),
      createdAt: SimpleFaker.pastDate(),
      updatedAt: SimpleFaker.recentDate(),
      verified: SimpleFaker.boolean(),
    };

    return { ...baseUser, ...overrides };
  }

  static createCreator(options: FactoryOptions = {}): User {
    return this.create({
      ...options,
      overrides: {
        role: 'creator',
        verified: true,
        ...options.overrides,
      },
    });
  }

  static createMany(count: number): User[] {
    return Array.from({ length: count }, () => this.create());
  }
}

// 📝 **CONTENT FACTORY**
export class ContentFactory {
  static create(options: FactoryOptions = {}): Content {
    const { overrides = {} } = options;

    const baseContent: Content = {
      id: SimpleFaker.uuid(),
      title: SimpleFaker.sentence(),
      body: SimpleFaker.paragraph(),
      authorId: SimpleFaker.uuid(),
      status: SimpleFaker.arrayElement(['draft', 'published', 'archived']),
      createdAt: SimpleFaker.pastDate(),
      viewCount: SimpleFaker.number(0, 10000),
      likeCount: SimpleFaker.number(0, 1000),
    };

    return { ...baseContent, ...overrides };
  }

  static createMany(count: number): Content[] {
    return Array.from({ length: count }, () => this.create());
  }
}

// 📊 **ANALYTICS FACTORY**
export class AnalyticsFactory {
  static create(options: FactoryOptions = {}): Analytics {
    const { overrides = {} } = options;

    const baseAnalytics: Analytics = {
      id: SimpleFaker.uuid(),
      userId: SimpleFaker.uuid(),
      period: SimpleFaker.arrayElement(['24h', '7d', '30d', '90d']),
      totalEngagement: SimpleFaker.number(100, 10000),
      engagementRate: SimpleFaker.number(1, 15) / 100,
      generatedAt: SimpleFaker.recentDate(),
    };

    return { ...baseAnalytics, ...overrides };
  }

  static createMany(count: number): Analytics[] {
    return Array.from({ length: count }, () => this.create());
  }
}

// 💰 **PAYMENT FACTORY**
export class PaymentFactory {
  static create(options: FactoryOptions = {}): Payment {
    const { overrides = {} } = options;

    const basePayment: Payment = {
      id: SimpleFaker.uuid(),
      fromUserId: SimpleFaker.uuid(),
      toUserId: SimpleFaker.uuid(),
      amount: SimpleFaker.number(100, 100000),
      status: SimpleFaker.arrayElement(['pending', 'completed', 'failed']),
      createdAt: SimpleFaker.pastDate(),
    };

    return { ...basePayment, ...overrides };
  }

  static createMany(count: number): Payment[] {
    return Array.from({ length: count }, () => this.create());
  }
}

// 🎭 **MOCK API RESPONSE FACTORY**
export class MockApiResponseFactory {
  static success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }

  static error(
    message: string,
    status: number = 400
  ): {
    success: false;
    error: string;
    status: number;
  } {
    return { success: false, error: message, status };
  }
}

// 🔧 **UTILITY FUNCTIONS**
export function createUserWithContent(contentCount: number = 3): {
  user: User;
  content: Content[];
} {
  const user = UserFactory.createCreator();
  const content = Array.from({ length: contentCount }, () =>
    ContentFactory.create({ overrides: { authorId: user.id } })
  );
  return { user, content };
}

export function resetTestDataSeed(seed: number = 12345): void {
  SimpleFaker.setSeed(seed);
}
