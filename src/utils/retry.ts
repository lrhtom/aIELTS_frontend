/**
 * Retry helper: exponential backoff
 * Used for transient network errors and timeouts
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // ms
  maxDelay?: number; // ms
  backoffMultiplier?: number;
  onProgress?: (attempt: number, maxAttempts: number, error?: unknown) => void;
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

/**
 * Is this a transient, retryable error?
 * - 408 Request Timeout
 * - 429 Too Many Requests
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable
 * - 504 Gateway Timeout
 * - network errors (ERR_NETWORK and friends)
 */
function isTransientError(error: unknown): boolean {
  try {
    const axiosError = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const status = axiosError?.response?.status;
    
    // check the HTTP status code
    if (status) {
      return [408, 429, 500, 502, 503, 504].includes(status);
    }
    
    // check for a network error
    if (axiosError?.code) {
      // axios network error
      return ['ECONNABORTED', 'ENOTFOUND', 'ERR_NETWORK', 'ETIMEDOUT'].includes(
        axiosError.code
      );
    }
    
    // look for network keywords in the error message
    const message = String((error as any)?.message || '').toLowerCase(); // eslint-disable-line @typescript-eslint/no-explicit-any
    return message.includes('timeout') || 
           message.includes('network') || 
           message.includes('connection') ||
           message.includes('refused');
  } catch {
    return false;
  }
}

/**
 * Non-blocking errors: errors that must not be retried
 * - 400 Bad Request
 * - 401 Unauthorized  
 * - 402 Payment Required (not enough AT)
 * - 403 Forbidden
 * - 404 Not Found
 * - 409 Conflict
 * - 422 Unprocessable Entity
 */
function isNonTransientError(error: unknown): boolean {
  try {
    const axiosError = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const status = axiosError?.response?.status;
    return status && [400, 401, 402, 403, 404, 409, 422].includes(status);
  } catch {
    return false;
  }
}

/**
 * Retry with exponential backoff
 * @param fn the async function to run
 * @param options retry options
 * @returns a Promise that either resolves with the result or rejects with the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    initialDelay = 1000, // 1s
    maxDelay = 30000, // 30s
    backoffMultiplier = 2,
    onProgress,
    onRetry,
  } = options;

  let lastError: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[重试] 第 ${attempt}/${maxAttempts} 次尝试...`,
        { maxAttempts }
      );
      
      onProgress?.(attempt, maxAttempts);
      const result = await fn();
      
      if (attempt > 1) {
        console.log(`[重试] 成功！用了 ${attempt} 次尝试`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // The request was deliberately cancelled (AbortController / CanceledError) - no logging, just rethrow
      if (
        (error as any)?.code === 'ERR_CANCELED' ||
        (error as any)?.name === 'CanceledError'
      ) {
        throw error;
      }

      console.warn(`[重试] 第 ${attempt} 次失败:`, error);

      // check for a permanent error
      if (isNonTransientError(error)) {
        console.error(`[重试] 永久错误 (不重试):`, {
          status: (error as any)?.response?.status, // eslint-disable-line @typescript-eslint/no-explicit-any
          message: (error as any)?.response?.data?.error || String(error), // eslint-disable-line @typescript-eslint/no-explicit-any
        });
        throw error;
      }

      // check for a transient, retryable error
      if (!isTransientError(error)) {
        console.error(`[重试] 非网络临时错误 (不重试):`, error);
        throw error;
      }

      // the last attempt failed, throw
      if (attempt === maxAttempts) {
        console.error(
          `[重试] 已达最大重试次数 (${maxAttempts})，放弃重试`
        );
        throw error;
      }

      // compute the delay (exponential backoff)
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      console.log(
        `[重试] 等待 ${delay}ms 后进行第 ${attempt + 1} 次尝试...`
      );
      
      onRetry?.(attempt, delay, error);

      // wait the given time, then retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // unreachable, but just in case
  throw lastError || new Error('Unknown error after maximum retries');
}

/**
 * Retry wrapper with a user-facing notice
 * Shows a 'retrying...' notice automatically and hides it when done
 */
export async function retryWithUserFeedback<T>(
  fn: () => Promise<T>,
  options: {
    onRetrying?: (attempt: number, maxAttempts: number) => void;
    onRetryFailed?: (attempt: number, delay: number) => void;
    maxAttempts?: number;
  } = {}
): Promise<T> {
  const { onRetrying, onRetryFailed, maxAttempts = 5 } = options;

  return retryWithBackoff(fn, {
    maxAttempts,
    onProgress: (attempt, max) => {
      if (attempt > 1) {
        onRetrying?.(attempt, max);
      }
    },
    onRetry: (attempt, delay) => {
      console.log(`[用户提示] 连接失败，${delay}ms 后重试 (${attempt + 1}/${maxAttempts})`);
      onRetryFailed?.(attempt, delay);
    },
  });
}
