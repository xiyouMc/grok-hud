import type { RenderContext } from '../types.js';
export declare function render(ctx: RenderContext): string;
/** Single-line output suitable for tmux status-right */
export declare function renderTmux(ctx: RenderContext, color?: boolean): string;
export declare function renderJson(ctx: RenderContext): string;
export declare function lineCount(text: string): number;
//# sourceMappingURL=index.d.ts.map