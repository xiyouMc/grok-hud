import type { RenderContext } from '../types.js';
import { stripAnsi } from './colors.js';
export declare function render(ctx: RenderContext): string;
/** Single-line output suitable for tmux status-right */
export declare function renderTmux(ctx: RenderContext, color?: boolean): string;
export declare function renderJson(ctx: RenderContext): string;
export declare function lineCount(text: string): number;
/** Approximate terminal rows used by text (accounts for line wrap). */
export declare function visualRowCount(text: string, columns?: number | null): number;
export { stripAnsi };
//# sourceMappingURL=index.d.ts.map