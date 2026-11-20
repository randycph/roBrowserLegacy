/**
 * UI/Components/Equipment/EquipmentV4/EquipmentV4.js
 *
 * Chararacter Equipment window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { createEquipment } from '../EquipmentCommon.js?v=item-foreground';
import htmlText from './EquipmentV4.html?raw';
import cssText from './EquipmentV4.css?raw';
import shellCss from '../../RpgPanel.css?raw';
import panelCss from '../EquipmentPanel.css?raw&v=item-foreground';

export default createEquipment({
	name: 'EquipmentV4',
	htmlText,
	cssText: cssText + shellCss + panelCss,
	modernPanel: true,
	enchantGrade: true,
	switchEquip: true,
	titles: true,
	costumeConfig: true,
	damageSkin: true
});
