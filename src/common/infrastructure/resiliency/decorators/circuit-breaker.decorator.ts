import { SetMetadata } from '@nestjs/common';
import { CircuitBreakerPolicy, ConsecutiveBreaker, SamplingBreaker } from 'cockatiel';
import { ExecuteWrapper } from 'cockatiel/dist/common/Executor';

export const CIRCUIT_BREAKER_KEY = 'circuit_breaker';

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  /**
   * Strategy: 'consecutive' or 'sampling'
   * - consecutive: Open after N consecutive failures
   * - sampling: Open when failure rate exceeds threshold in time window
   */
  strategy?: 'consecutive' | 'sampling';

  /**
   * Failure threshold
   * - For consecutive: Number of consecutive failures (default: 5)
   * - For sampling: Failure rate 0-1 (default: 0.5 = 50%)
   */
  threshold?: number;

  /**
   * Half-open duration in milliseconds
   * Time before circuit breaker enters half-open state (default: 30000 = 30 seconds)
   */
  halfOpenAfter?: number;

  /**
   * Sampling duration in milliseconds (for sampling strategy only)
   * Time window for calculating failure rate (default: 10000 = 10 seconds)
   */
  samplingDuration?: number;

  /**
   * Minimum throughput (for sampling strategy only)
   * Minimum number of requests before circuit breaker can open (default: 10)
   */
  minimumThroughput?: number;

  /**
   * Fallback function to execute when circuit is open
   */
  fallback?: (...args: any[]) => any;

  /**
   * Name for this circuit breaker (for metrics and logging)
   */
  name?: string;
}

/**
 * @CircuitBreaker Decorator
 *
 * Method-level decorator that wraps method execution in a circuit breaker pattern.
 *
 * Circuit Breaker States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast (return fallback immediately)
 * - HALF_OPEN: Testing if service recovered, allow 1 request through
 *
 * Features:
 * - Prevents cascade failures by failing fast
 * - Automatic recovery detection (half-open state)
 * - Two strategies: consecutive failures or failure rate sampling
 * - Configurable fallback function
 * - Metrics emission on state changes
 *
 * @param options - Circuit breaker configuration
 *
 * @example
 * ```typescript
 * // Consecutive failures strategy
 * class Auth0Service {
 *   @CircuitBreaker({
 *     strategy: 'consecutive',
 *     threshold: 5,              // Open after 5 consecutive failures
 *     halfOpenAfter: 30000,      // Try again after 30 seconds
 *     fallback: () => null,      // Return null when circuit open
 *     name: 'auth0-create-user'
 *   })
 *   async createUser(dto: CreateUserDto) {
 *     return await this.auth0Client.users.create(dto);
 *   }
 * }
 *
 * // Sampling strategy
 * class PaymentService {
 *   @CircuitBreaker({
 *     strategy: 'sampling',
 *     threshold: 0.5,            // Open when >50% fail
 *     samplingDuration: 10000,   // In 10 second window
 *     minimumThroughput: 10,     // Need at least 10 requests
 *     halfOpenAfter: 60000,      // Try again after 60 seconds
 *     name: 'payment-process'
 *   })
 *   async processPayment(dto: PaymentDto) {
 *     return await this.stripeClient.charges.create(dto);
 *   }
 * }
 * ```
 *
 * State Transitions:
 * ```
 * CLOSED --[threshold failures]--> OPEN --[halfOpenAfter]--> HALF_OPEN
 *   ^                                                            |
 *   |                                                            |
 *   +----[success in half-open]-----+       [failure]--------> OPEN
 * ```
 *
 * Complies with:
 * - RESILIENCY-10: Circuit breakers for external service calls
 */
export const CircuitBreaker = (options: CircuitBreakerOptions = {}) => {
  return SetMetadata(CIRCUIT_BREAKER_KEY, options);
};

/**
 * Create Circuit Breaker Policy
 *
 * Factory function to create a Cockatiel circuit breaker policy based on options.
 * This is used internally by the circuit breaker interceptor.
 *
 * @param options - Circuit breaker configuration
 * @returns Cockatiel CircuitBreakerPolicy
 */
export function createCircuitBreakerPolicy(options: CircuitBreakerOptions): CircuitBreakerPolicy {
  const {
    strategy = 'consecutive',
    threshold = strategy === 'consecutive' ? 5 : 0.5,
    halfOpenAfter = 30000, // 30 seconds
    samplingDuration = 10000, // 10 seconds
    minimumThroughput = 10,
  } = options;

  let breaker;

  if (strategy === 'consecutive') {
    // Consecutive failures strategy
    // Opens after N consecutive failures
    breaker = new ConsecutiveBreaker(threshold as number);
  } else {
    // Sampling strategy
    // Opens when failure rate exceeds threshold in time window
    breaker = new SamplingBreaker({
      threshold: threshold as number, // Failure rate 0-1
      duration: samplingDuration, // Time window
      minimumRps: minimumThroughput / (samplingDuration / 1000), // Minimum requests per second
    });
  }

  // Create circuit breaker policy with half-open duration
  // In Cockatiel v3, create CircuitBreakerPolicy directly with ExecuteWrapper
  const executor = new ExecuteWrapper();
  return new CircuitBreakerPolicy({ breaker, halfOpenAfter }, executor);
}

/**
 * Circuit Breaker Registry
 *
 * Global registry of circuit breaker policies by name.
 * Allows sharing circuit breakers across multiple instances of the same method.
 */
export class CircuitBreakerRegistry {
  private static policies: Map<string, CircuitBreakerPolicy> = new Map();

  /**
   * Get or create circuit breaker policy
   *
   * @param name - Circuit breaker name
   * @param options - Circuit breaker options
   * @returns Circuit breaker policy
   */
  static getOrCreate(name: string, options: CircuitBreakerOptions): CircuitBreakerPolicy {
    if (!this.policies.has(name)) {
      const policy = createCircuitBreakerPolicy(options);
      this.policies.set(name, policy);
    }

    return this.policies.get(name)!;
  }

  /**
   * Get circuit breaker policy by name
   *
   * @param name - Circuit breaker name
   * @returns Circuit breaker policy or undefined
   */
  static get(name: string): CircuitBreakerPolicy | undefined {
    return this.policies.get(name);
  }

  /**
   * Get all circuit breaker policies
   *
   * @returns Map of circuit breaker policies
   */
  static getAll(): Map<string, CircuitBreakerPolicy> {
    return this.policies;
  }

  /**
   * Clear all circuit breakers (for testing)
   */
  static clear(): void {
    this.policies.clear();
  }
}
