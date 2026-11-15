const states = { skill: false, attendance: false, mail: false };

export function setToolbarNotice(name, visible) {
	if (!(name in states)) return;
	states[name] = Boolean(visible);
	for (const id of ['BasicInfoV4', 'BasicInfoV5']) {
		const root = document.getElementById(id)?.shadowRoot;
		root?.querySelector(`#${name} .notice-dot`)?.classList.toggle('visible', states[name]);
	}
}

export function syncToolbarNotices(root) {
	for (const [name, visible] of Object.entries(states)) {
		root.querySelector(`#${name} .notice-dot`)?.classList.toggle('visible', visible);
	}
}

export function resetToolbarNotices() {
	for (const name of Object.keys(states)) setToolbarNotice(name, false);
}
