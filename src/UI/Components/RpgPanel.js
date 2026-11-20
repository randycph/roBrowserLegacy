export const RPG_WINDOW_LAYER = 1450;

export function centerPanel(host) {
	const { width, height } = host.getBoundingClientRect();
	host.style.left = `${Math.max(8, (window.innerWidth - width) / 2)}px`;
	host.style.top = `${Math.max(8, (window.innerHeight - height) / 2)}px`;
}

export function keepPanelInViewport(host, shouldClamp = () => true) {
	const observer = new ResizeObserver(() => {
		if (!shouldClamp()) {
			return;
		}
		const box = host.getBoundingClientRect();
		if (!box.width || !box.height) {
			return;
		}

		const top = Math.max(8, Math.min(box.top, window.innerHeight - box.height - 8));
		const left = Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8));
		host.style.top = `${top}px`;
		host.style.left = `${left}px`;
	});
	observer.observe(host);
}
