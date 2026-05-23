/**
 * 重试工具：指数退避重试机制
 * 用于处理临时网络错误和超时
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
 * 检查是否是可重试的临时错误
 * - 408 Request Timeout
 * - 429 Too Many Requests
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable
 * - 504 Gateway Timeout
 * - 网络错误（ERR_NETWORK 等）
 */
function isTransientError(error: unknown): boolean {
  try {
    const axiosError = error as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const status = axiosError?.response?.status;
    
    // HTTP 状态码判断
    if (status) {
      return [408, 429, 500, 502, 503, 504].includes(status);
    }
    
    // 网络错误判断
    if (axiosError?.code) {
      // axios 网络错误
      return ['ECONNABORTED', 'ENOTFOUND', 'ERR_NETWORK', 'ETIMEDOUT'].includes(
        axiosError.code
      );
    }
    
    // 检查错误消息中的网络关键词
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
 * 非阻塞错误：不应该重试的错误
 * - 400 Bad Request
 * - 401 Unauthorized  
 * - 402 Payment Required (AT币不足)
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
 * 带指数退避的重试机制
 * @param fn 要执行的异步函数
 * @param options 重试选项
 * @returns Promise，要么解析为结果，要么拒绝最后的错误
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
      
      console.warn(`[重试] 第 ${attempt} 次失败:`, error);
      
      // 检查是否是永久错误
      if (isNonTransientError(error)) {
        console.error(`[重试] 永久错误 (不重试):`, {
          status: (error as any)?.response?.status, // eslint-disable-line @typescript-eslint/no-explicit-any
          message: (error as any)?.response?.data?.error || String(error), // eslint-disable-line @typescript-eslint/no-explicit-any
        });
        throw error;
      }

      // 检查是否是可重试的临时错误
      if (!isTransientError(error)) {
        console.error(`[重试] 非网络临时错误 (不重试):`, error);
        throw error;
      }

      // 最后一次尝试失败，抛出错误
      if (attempt === maxAttempts) {
        console.error(
          `[重试] 已达最大重试次数 (${maxAttempts})，放弃重试`
        );
        throw error;
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      console.log(
        `[重试] 等待 ${delay}ms 后进行第 ${attempt + 1} 次尝试...`
      );
      
      onRetry?.(attempt, delay, error);

      // 等待指定时间后重试
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 不应该到达这里，但以防万一
  throw lastError || new Error('Unknown error after maximum retries');
}

/**
 * 带用户提示的重试包装
 * 自动显示"重试中..."提示，并在完成后隐藏
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
