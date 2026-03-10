export function formatATBalance(balance: number | undefined | null): string | number {
    if (balance === undefined || balance === null) return 0;

    if (balance >= 1000 || balance <= -1000) {
        return Math.trunc(balance / 1000) + 'k';
    }

    return balance;
}
