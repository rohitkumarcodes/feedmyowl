declare module "@postlight/parser" {
  interface ParseResult {
    title?: string;
    author?: string;
    content?: string;
  }

  interface ParseOptions {
    contentType?: "html" | "markdown" | "text";
  }

  interface PostlightParser {
    parse(url: string, options?: ParseOptions): Promise<ParseResult | null>;
  }

  const parser: PostlightParser;
  export default parser;
}
