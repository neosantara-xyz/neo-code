import { describe, expect, it } from "vitest";
import {
	getAvailableThemes,
	getAvailableThemesWithPaths,
	getResolvedThemeColors,
	getThemeExportColors,
	initTheme,
	isLightTheme,
	theme,
} from "../src/modes/interactive/theme/theme.js";

describe("Neosantara built-in themes", () => {
	it("registers the brand themes as built-ins", () => {
		expect(getAvailableThemes()).toContain("neosantara");
		expect(getAvailableThemes()).toContain("neosantara-light");

		const themePaths = getAvailableThemesWithPaths();
		expect(themePaths.find((item) => item.name === "neosantara")?.path).toMatch(/neosantara\.json$/);
		expect(themePaths.find((item) => item.name === "neosantara-light")?.path).toMatch(/neosantara-light\.json$/);
	});

	it("resolves colors from the uploaded CSS palette", () => {
		expect(getResolvedThemeColors("neosantara")).toMatchObject({
			accent: "#e67a00",
			text: "#fafafa",
			selectedBg: "#663600",
		});
		expect(getThemeExportColors("neosantara")).toMatchObject({
			pageBg: "#080808",
			cardBg: "#0d0d0d",
			infoBg: "#1a0e00",
		});

		expect(getResolvedThemeColors("neosantara-light")).toMatchObject({
			accent: "#ff8800",
			text: "#0d0d0d",
			selectedBg: "#efc28f",
		});
		expect(isLightTheme("neosantara-light")).toBe(true);
	});

	it("can initialize the default Neosantara theme", () => {
		initTheme("neosantara");

		expect(theme.name).toBe("neosantara");
		expect(theme.fg("accent", "Neo")).toContain("Neo");
	});
});
