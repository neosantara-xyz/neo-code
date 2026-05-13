import { Container, Text } from "@neosantara/tui";

export class NeosantaraAnnouncementComponent extends Container {
	constructor() {
		super();
		this.addChild(new Text("NAI Code by Neosantara", 1, 0));
		this.addChild(new Text("Neosantara-first coding assistant for your terminal.", 1, 0));
	}
}
