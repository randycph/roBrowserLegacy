/**
 * UI/Components/CharSelect/CharSelect.js
 *
 * Character Selection
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 */

import CharSelect from './CharSelect/CharSelect.js';
import CharSelectV2 from './CharSelectV2/CharSelectV2.js';
import CharSelectV3 from './CharSelectV3/CharSelectV3.js?v=carousel8';
import CharSelectV4 from './CharSelectV4/CharSelectV4.js?v=carousel8';
import UIVersionManager from 'UI/UIVersionManager.js';

const publicName = 'CharSelect';
const versionInfo = {
	default: CharSelect,
	common: {
		20180124: CharSelectV3,
		20141016: CharSelectV3,
		20100803: CharSelectV2,
		20100728: CharSelect,
		20100720: CharSelectV2
	},
	re: {},
	prere: {}
};

const Controller = UIVersionManager.getUIController(publicName, versionInfo, { phase: 'char' });

CharSelectV3.onAdvancedView = () => {
	const snapshot = CharSelectV3.getViewSnapshot();
	const selected = CharSelectV3.getSelectedIndex();
	for (const key of ['onExitRequest', 'onConnectRequest', 'onCreateRequest', 'onDeleteRequest', 'onDeleteReqDelay', 'onCancelDeleteRequest']) {
		CharSelectV4[key] = (...args) => {
			if (['onExitRequest', 'onConnectRequest', 'onCreateRequest'].includes(key)) CharSelectV4.remove();
			return CharSelectV3[key]?.(...args);
		};
	}
	CharSelectV3.remove();
	CharSelectV4.append();
	CharSelectV4.setInfo(snapshot);
	CharSelectV4.selectSlot(selected);
};

CharSelectV4.onClassicView = () => {
	const selected = CharSelectV4.getSelectedIndex();
	CharSelectV4.remove();
	CharSelectV3.append();
	CharSelectV3.selectSlot(selected);
};
export default Controller;
