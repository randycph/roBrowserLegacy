/**
 * UI/Components/Equipment/EquipmentV3/EquipmentV3.js
 *
 * Chararacter Equipment window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { createEquipment } from '../EquipmentCommon.js?v=item-foreground';
import htmlText from './EquipmentV3.html?raw';
import cssText from './EquipmentV3.css?raw';
import shellCss from '../../RpgPanel.css?raw';
import panelCss from '../EquipmentPanel.css?raw&v=item-foreground';

export default createEquipment({
	name: 'EquipmentV3',
	htmlText,
	cssText: cssText + shellCss + panelCss,
	modernPanel: true,
	enchantGrade: true,
	switchEquip: true,
	titles: true
});
