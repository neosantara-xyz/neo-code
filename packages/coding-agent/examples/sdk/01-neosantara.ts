import { getModel } from "@neosantara/ai";
import { createAgentSession } from "@neosantara/code";

const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");
if (!model) throw new Error("Neosantara default model not found");

const { session } = await createAgentSession({ model });
console.log(`Created session with ${session.model.provider}/${session.model.id}`);
