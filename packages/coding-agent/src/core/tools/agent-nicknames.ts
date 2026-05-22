/**
 * Nusantara-themed nickname pool for spawned subagents.
 *
 * Codex's multi-agent system assigns each spawned sub-agent a random nickname
 * pulled from a list of historical scientists (Euclid, Archimedes, …). Neo Code
 * follows the same idea, but with figures from Nusantara's history: scholars,
 * scientists, founding leaders, writers, and reformers. The intent is purely
 * cosmetic — nicknames make logs and progress lines easier to scan when several
 * subagents run in parallel.
 *
 * Add new entries at the end of the list. Each entry must be a single
 * human-readable string. Avoid duplicates so the picker can rotate fairly.
 */
export const NUSANTARA_AGENT_NICKNAMES: ReadonlyArray<string> = [
	// Pre-colonial leaders and scholars
	"Hayam Wuruk",
	"Gajah Mada",
	"Airlangga",
	"Ken Arok",
	"Mpu Tantular",
	"Mpu Sindok",
	"Mpu Sedah",
	"Mpu Panuluh",
	"Mpu Prapanca",
	"Sultan Agung",
	"Sultan Iskandar Muda",
	"Sultan Hasanuddin",
	"Sultan Trenggana",
	"Sultan Babullah",
	"Sultan Nuku",
	"Sunan Kalijaga",
	"Sunan Bonang",
	"Sunan Giri",
	"Sunan Gunung Jati",
	"Sunan Ampel",
	"Pangeran Antasari",
	"Pangeran Diponegoro",
	"Pattimura",
	"Tuanku Imam Bonjol",
	"Cut Nyak Dhien",
	"Cut Nyak Meutia",
	"Teuku Umar",
	"Sisingamangaraja",
	"Tjoet Meutia",
	"I Gusti Ngurah Rai",
	"Untung Surapati",
	"Hasanuddin Pinjam",

	// Founding generation and reformers
	"Sukarno",
	"Mohammad Hatta",
	"Sjahrir",
	"Tan Malaka",
	"Agus Salim",
	"Kartini",
	"Dewi Sartika",
	"Maria Walanda Maramis",
	"Rasuna Said",
	"Fatmawati",
	"Mohammad Yamin",
	"Ki Hajar Dewantara",
	"Wahid Hasyim",
	"Hasyim Asyari",
	"Ahmad Dahlan",
	"Soepomo",
	"Sukarni",
	"Chairul Saleh",
	"Wage Rudolf Soepratman",
	"Latief Hendraningrat",

	// Modern scientists, writers, and humanists
	"Bacharuddin Habibie",
	"Pramoedya Ananta Toer",
	"Chairil Anwar",
	"Sutan Sjahrir",
	"Sapardi Djoko Damono",
	"Buya Hamka",
	"Soedjatmoko",
	"Affandi",
	"Raden Saleh",
	"Mochtar Lubis",
	"Y.B. Mangunwijaya",
	"Soejatmoko",
	"Soeroso",
	"Widjojo Nitisastro",
	"Sumitro Djojohadikusumo",
	"Soemitro",
	"Nurcholish Madjid",
];

/**
 * Deterministic, lightweight string hash used by {@link pickAgentNickname} so
 * nicknames stay stable when the same seed is provided. Implementation is the
 * classic FNV-1a 32-bit variant — small, fast, and dependency-free.
 */
function hashSeed(seed: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	// Force unsigned 32-bit so we can take a modulo against the array length.
	return hash >>> 0;
}

/**
 * Pick a nickname from {@link NUSANTARA_AGENT_NICKNAMES}.
 *
 * - When `seed` is provided, the pick is deterministic. Use this when several
 *   render passes need to land on the same name (e.g. when the agent tool's
 *   `renderCall` is invoked multiple times for the same invocation).
 * - When `seed` is omitted, falls back to `Math.random()` so callers that just
 *   want a one-shot fun label still get variety.
 *
 * The pool is finite, so collisions are expected when many subagents run in
 * the same session. That's acceptable for a cosmetic label.
 */
export function pickAgentNickname(seed?: string): string {
	if (NUSANTARA_AGENT_NICKNAMES.length === 0) {
		return "Anonymous";
	}
	const index =
		typeof seed === "string" && seed.length > 0
			? hashSeed(seed) % NUSANTARA_AGENT_NICKNAMES.length
			: Math.floor(Math.random() * NUSANTARA_AGENT_NICKNAMES.length);
	return NUSANTARA_AGENT_NICKNAMES[index]!;
}

/**
 * Snapshot of the nickname pool for tests and audit logs.
 */
export function getNusantaraAgentNicknames(): ReadonlyArray<string> {
	return NUSANTARA_AGENT_NICKNAMES;
}
