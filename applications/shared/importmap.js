// applications/shared/importmap.js
(function () {
	const script = document.currentScript || document.querySelector('script[src*="shared/importmap.js"]');
	if (!script) return;

	let projectRoot = script.dataset.projectRoot;
	if (!projectRoot) {
		const splitPoint = script.dataset.projectRootSplit || '/applications/';
		projectRoot = new URL(window.location.href).pathname.split(splitPoint)[0] + '/';
	}
	const xhr = new XMLHttpRequest();
	xhr.open('GET', `${projectRoot}aliases.json`, false);
	xhr.send(null);
	const aliases = JSON.parse(xhr.responseText);

	const imports = { 'src/': `${projectRoot}src/` };
	aliases.dirs.forEach(d => {
		imports[`${d}/`] = `${projectRoot}src/${d}/`;
	});
	Object.keys(aliases.packages).forEach(k => {
		imports[k] = `${projectRoot}${aliases.packages[k]}`;
	});

	Object.assign(imports, {
			'Network/NetworkManager.js': `${projectRoot}src/Network/NetworkManager.js?v=npcshop2`,

			'Network/PacketRegister.js': `${projectRoot}src/Network/PacketRegister.js?v=npcshop2`,

			'UI/Components/CharSelect/CharSelect.js': `${projectRoot}src/UI/Components/CharSelect/CharSelect.js?v=carousel8`,

			'UI/Components/CheckAttendance/CheckAttendance.js': `${projectRoot}src/UI/Components/CheckAttendance/CheckAttendance.js?v=notices6`,

			'UI/Components/AutoLoot/AutoLoot.js': `${projectRoot}src/UI/Components/AutoLoot/AutoLoot.js?v=combat2`,

			'UI/Components/MiniMap/MiniMap.js': `${projectRoot}src/UI/Components/MiniMap/MiniMap.js?v=modern2`,

			'UI/Components/ChatBox/ChatBox.js': `${projectRoot}src/UI/Components/ChatBox/ChatBox.js?v=chatmodern1`,

			'UI/Components/AutoCombat/AutoCombat.js': `${projectRoot}src/UI/Components/AutoCombat/AutoCombat.js?v=selfbuff1`,

			'UI/Components/StatusIcons/StatusIcons.js': `${projectRoot}src/UI/Components/StatusIcons/StatusIcons.js?v=selfbuff1`,

			'UI/Components/NpcStore/NpcStore.js': `${projectRoot}src/UI/Components/NpcStore/NpcStore.js?v=npcclose1`,

			'Engine/MapEngine.js': `${projectRoot}src/Engine/MapEngine.js?v=npcshop2`,

			'UI/Components/BasicInfo/BasicInfo.js': `${projectRoot}src/UI/Components/BasicInfo/BasicInfo.js?v=combat2`,

			'Renderer/MapRenderer.js': `${projectRoot}src/Renderer/MapRenderer.js?v=attendance4`,

			'UI/Background.js': `${projectRoot}src/UI/Background.js?v=attendance4`,
	});
	const s = document.createElement('script');
	s.type = 'importmap';
	s.textContent = JSON.stringify({ imports: imports });
	script.after(s);
})();
