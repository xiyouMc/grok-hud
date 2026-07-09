import type { HudColorOverrides } from '../config.js';
export declare const RESET = "\u001B[0m";
export declare function dim(text: string): string;
export declare function green(text: string): string;
export declare function yellow(text: string): string;
export declare function red(text: string): string;
export declare function cyan(text: string): string;
export declare function magenta(text: string): string;
export declare function model(text: string, colors?: HudColorOverrides): string;
export declare function project(text: string, colors?: HudColorOverrides): string;
export declare function git(text: string, colors?: HudColorOverrides): string;
export declare function gitBranch(text: string, colors?: HudColorOverrides): string;
export declare function label(text: string, colors?: HudColorOverrides): string;
export declare function tools(text: string, colors?: HudColorOverrides): string;
export declare function stats(text: string, colors?: HudColorOverrides): string;
export declare function warning(text: string, colors?: HudColorOverrides): string;
export declare function critical(text: string, colors?: HudColorOverrides): string;
export declare function contextColor(percent: number, colors?: HudColorOverrides, warn?: number, crit?: number): string;
export declare function colorByPercent(text: string, percent: number, colors?: HudColorOverrides, warn?: number, crit?: number): string;
export declare function bar(percent: number, width?: number, colors?: HudColorOverrides, warn?: number, crit?: number): string;
/** Strip ANSI for width calculations / tmux plain mode */
export declare function stripAnsi(str: string): string;
//# sourceMappingURL=colors.d.ts.map