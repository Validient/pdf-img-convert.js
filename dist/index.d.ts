/// <reference types="node" resolution-mode="require"/>
interface IConversionConfig {
    /** Number in px */
    width?: number;
    /** Number in px */
    height?: number;
    /** A list of pages to render instead of all of them */
    page_numbers?: number[];
    /** Output as base64 */
    base64?: boolean;
    /** Viewport scale as ratio */
    scale?: number;
    /** Controls the `isEvalSupported` parameter of `pdf-js`. Defaults to `true`. */
    isEvalSupported?: boolean;
}
export declare function convert(pdf: string | Buffer | Uint8Array, conversion_config?: IConversionConfig): Promise<Uint8Array | (string | Uint8Array)[]>;
export {};
