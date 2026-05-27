import assert from "node:assert/strict";
import { PUBLIC_PRICING_CTA, PUBLIC_PRICING_PRICES } from "../src/app/pricing/pricing-prices";

assert.equal(PUBLIC_PRICING_PRICES.free, "Rp 0");
assert.equal(PUBLIC_PRICING_PRICES.basic, "Rp 85K");
assert.equal(PUBLIC_PRICING_PRICES.standard, "Rp 670K");
assert.equal(PUBLIC_PRICING_PRICES.pro, "Rp 3.35M");
assert.equal(PUBLIC_PRICING_PRICES.enterprise, "Custom");
assert.equal(PUBLIC_PRICING_CTA, "Try Neosantara");
