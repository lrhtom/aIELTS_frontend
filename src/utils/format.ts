export function formatATBalance(balance: number | undefined | null): string | number {
    if (balance === undefined || balance === null) return 0;

    if (balance >= 1000 || balance <= -1000) {
        return Math.trunc(balance / 1000) + 'k';
    }

    return balance;
}

export function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('zh-CN', { hour12: false });
}
