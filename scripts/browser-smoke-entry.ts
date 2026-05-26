import { complete, getModel } from "@neosantara/ai";

const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");
console.log(model.id, typeof complete);
