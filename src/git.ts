import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' },
    );
    const branch = branchOut.trim();
    if (!branch) return null;

    let isDirty = false;
    try {
      const { stdout: statusOut } = await execFileAsync(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: 1000, encoding: 'utf8' },
      );
      isDirty = statusOut.trim().length > 0;
    } catch {
      // ignore
    }

    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: abOut } = await execFileAsync(
        'git',
        ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
        { cwd, timeout: 1000, encoding: 'utf8' },
      );
      const parts = abOut.trim().split(/\s+/);
      if (parts.length >= 2) {
        behind = Number.parseInt(parts[0] ?? '0', 10) || 0;
        ahead = Number.parseInt(parts[1] ?? '0', 10) || 0;
      }
    } catch {
      // no upstream
    }

    return { branch, isDirty, ahead, behind };
  } catch {
    return null;
  }
}
