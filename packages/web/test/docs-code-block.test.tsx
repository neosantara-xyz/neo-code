import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsCodeBlock } from "../src/app/docs/code-block";

const html = renderToStaticMarkup(
	<DocsCodeBlock code={'const value = "neo";'} language="ts" />,
);

assert.match(html, /data-copy-code=/);
assert.match(html, /aria-label="Copy code"/);
assert.match(html, /Copy/);
assert.match(html, /hljs-keyword/);
assert.match(html, /const value/);
