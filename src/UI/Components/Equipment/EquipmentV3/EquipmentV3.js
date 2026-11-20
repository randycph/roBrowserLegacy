/**
 * UI/Components/Equipment/EquipmentV3/EquipmentV3.js
 *
 * Chararacter Equipment window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { createEquipment } from '../EquipmentCommon.js?v=popup-headings';
import htmlText from './EquipmentV3.html?raw&v=popup-headings';
import cssText from './EquipmentV3.css?raw';
import shellCss from '../../RpgPanel.css?raw&v=popup-headings';
import panelCss from '../EquipmentPanel.css?raw&v=popup-headings';

export default createEquipment({
	name: 'EquipmentV3',
	htmlText,
	cssText: cssText + shellCss + panelCss,
	modernPanel: true,
	enchantGrade: true,
	switchEquip: true,
	titles: true
});
