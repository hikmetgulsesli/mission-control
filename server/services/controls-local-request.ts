/** Additional Controls policy. Global authentication remains the caller's responsibility. */
export function validateControlsLocalMutationV1(input: {
    actualAddress: {
        address: string;
        family: string;
        port: number;
    } | null;
    peerAddress: string | undefined;
    localAddress: string | undefined;
    rawHeaders: readonly string[];
    method: string;
    secFetchSite: string | undefined;
    query: string;
    contentLength: number | null;
}): boolean {
    const a = input.actualAddress;
    const loopback = (s: string | undefined) => s === '127.0.0.1' || s === '::ffff:127.0.0.1';
    if (!a || a.address !== '127.0.0.1' || a.family !== 'IPv4' || a.port !== 3080
        || !loopback(input.peerAddress) || !loopback(input.localAddress) || input.method !== 'POST' || input.query !== ''
        || (input.secFetchSite !== undefined && input.secFetchSite !== 'same-origin')
        || !Number.isSafeInteger(input.contentLength) || input.contentLength! <= 0 || input.contentLength! > 2048
        || input.rawHeaders.length % 2 !== 0)
        return false;
    const headers = new Map<string, string[]>();
    for (let i = 0; i < input.rawHeaders.length; i += 2) {
        const key = input.rawHeaders[i].toLowerCase();
        if (key === 'forwarded' || key.startsWith('x-forwarded-') || key === 'transfer-encoding')
            return false;
        headers.set(key, [...(headers.get(key) ?? []), input.rawHeaders[i + 1]]);
    }
    const exactly = (key: string, value: string) => headers.get(key)?.length === 1 && headers.get(key)![0] === value;
    if (!exactly('host', '127.0.0.1:3080') || !exactly('origin', 'http://127.0.0.1:3080'))
        return false;
    const type = headers.get('content-type');
    if (type?.length !== 1 || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(type[0]))
        return false;
    for (const key of ['content-length', 'sec-fetch-site', 'x-mc-token', 'authorization'])
        if ((headers.get(key)?.length ?? 0) > 1)
            return false;
    return true;
}
