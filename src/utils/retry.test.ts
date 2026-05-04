import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, retryWithUserFeedback, type RetryOptions } from './retry';

function createAxiosError(status: number, message?: string) {
  return { response: { status, data: { error: message } }, message };
}

describe('retryWithBackoff', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { initialDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient network error (503)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(createAxiosError(503))
      .mockRejectedValueOnce(createAxiosError(502))
      .mockResolvedValue('recovered');

    const result = await retryWithBackoff(fn, { initialDelay: 10, maxAttempts: 5 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 400 (non-transient)', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(400));
    await expect(retryWithBackoff(fn, { initialDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(401));
    await expect(retryWithBackoff(fn, { initialDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 402 (AT币不足)', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(402));
    await expect(retryWithBackoff(fn, { initialDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(403));
    await expect(retryWithBackoff(fn, { initialDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 404', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(404));
    await expect(retryWithBackoff(fn, { initialDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(503));
    await expect(
      retryWithBackoff(fn, { initialDelay: 10, maxDelay: 20, maxAttempts: 3 }),
    ).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onProgress callback', async () => {
    const onProgress = vi.fn();
    const fn = vi.fn().mockResolvedValue('ok');
    await retryWithBackoff(fn, { onProgress, initialDelay: 10 });
    expect(onProgress).toHaveBeenCalledWith(1, 5);
  });

  it('calls onRetry callback on failure', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(createAxiosError(503))
      .mockResolvedValue('ok');
    await retryWithBackoff(fn, { onRetry, initialDelay: 10 });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('retryWithUserFeedback', () => {
  it('returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithUserFeedback(fn);
    expect(result).toBe('ok');
  });

  it('passes through maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(createAxiosError(503));
    await expect(retryWithUserFeedback(fn, { maxAttempts: 2 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
