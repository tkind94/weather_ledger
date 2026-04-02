import { open, readFile, rm, stat } from 'node:fs/promises';

type LockMetadata = {
	pid: number;
	acquiredAt: number;
};

type LockOptions = {
	acquireTimeoutMs?: number;
	pollIntervalMs?: number;
	staleLockMs?: number;
};

const defaultAcquireTimeoutMs = 240_000;
const defaultPollIntervalMs = 25;
const defaultStaleLockMs = 5_000;

function delay(ms: number): Promise<void> {
	return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error;
}

function parseLockMetadata(value: string): LockMetadata | null {
	try {
		const parsed = JSON.parse(value) as Partial<LockMetadata>;
		if (typeof parsed.pid !== 'number' || typeof parsed.acquiredAt !== 'number') {
			return null;
		}

		return { pid: parsed.pid, acquiredAt: parsed.acquiredAt };
	} catch {
		return null;
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === 'ESRCH') {
			return false;
		}

		return true;
	}
}

async function releaseLock(lockPath: string): Promise<void> {
	try {
		await rm(lockPath, { force: true });
	} catch (error) {
		if (isNodeError(error) && error.code === 'ENOENT') {
			return;
		}

		throw error;
	}
}

async function clearStaleLockIfNeeded(lockPath: string, staleLockMs: number): Promise<void> {
	try {
		const [metadataText, lockStat] = await Promise.all([
			readFile(lockPath, 'utf8'),
			stat(lockPath)
		]);
		const ageMs = Date.now() - lockStat.mtimeMs;
		if (ageMs < staleLockMs) {
			return;
		}

		const metadata = parseLockMetadata(metadataText);
		if (metadata !== null && isProcessAlive(metadata.pid)) {
			return;
		}

		await releaseLock(lockPath);
	} catch (error) {
		if (isNodeError(error) && error.code === 'ENOENT') {
			return;
		}

		throw error;
	}
}

async function acquireLock(lockPath: string, options: LockOptions): Promise<() => Promise<void>> {
	const acquireTimeoutMs = options.acquireTimeoutMs ?? defaultAcquireTimeoutMs;
	const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs;
	const staleLockMs = options.staleLockMs ?? defaultStaleLockMs;
	const deadline = Date.now() + acquireTimeoutMs;

	while (true) {
		try {
			const handle = await open(lockPath, 'wx');
			try {
				const metadata: LockMetadata = {
					pid: process.pid,
					acquiredAt: Date.now()
				};
				await handle.writeFile(JSON.stringify(metadata));
			} finally {
				await handle.close();
			}

			return async () => releaseLock(lockPath);
		} catch (error) {
			if (!isNodeError(error) || error.code !== 'EEXIST') {
				throw error;
			}

			await clearStaleLockIfNeeded(lockPath, staleLockMs);
			if (Date.now() >= deadline) {
				throw new Error(`Timed out waiting for database lock: ${lockPath}`);
			}

			await delay(pollIntervalMs);
		}
	}
}

export async function withInterprocessLock<T>(
	lockPath: string,
	task: () => Promise<T>,
	options: LockOptions = {}
): Promise<T> {
	const release = await acquireLock(lockPath, options);
	try {
		return await task();
	} finally {
		await release();
	}
}
