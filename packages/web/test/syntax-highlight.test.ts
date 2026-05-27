import assert from "node:assert/strict";
import { highlightCodeBlock, normalizeHighlightLanguage } from "../src/app/docs/syntax-highlight";

assert.equal(normalizeHighlightLanguage("ts"), "typescript");
assert.equal(normalizeHighlightLanguage("tsx"), "typescript");
assert.equal(normalizeHighlightLanguage("sh"), "bash");
assert.equal(normalizeHighlightLanguage("unknown-language"), undefined);

const highlighted = highlightCodeBlock('const value = "neo";', "ts");
assert.equal(highlighted.highlighted, true);
assert.equal(highlighted.language, "typescript");
assert.match(highlighted.html, /hljs-keyword/);
assert.match(highlighted.html, /hljs-string/);

const escaped = highlightCodeBlock("<script>alert(1)</script>", "unknown-language");
assert.equal(escaped.highlighted, false);
assert.equal(escaped.html, "&lt;script&gt;alert(1)&lt;/script&gt;");
