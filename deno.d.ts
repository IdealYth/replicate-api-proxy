declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }
  
  export const env: Env;
  
  export function serve(handler: (request: Request) => Response | Promise<Response>, options?: any): void;
}

declare module "replicate" {
  export default class Replicate {
    constructor(options: { auth: string });
    run(modelId: string, options: { input: any }): Promise<any>;
    stream(modelId: string, options: { input: any }): AsyncIterable<any>;
  }
}

declare module "gpt-tokenizer/encoding/o200k_base" {
  export function encode(text: string): number[];
  export function decode(tokens: number[]): string;
} 