/**
 * UI/Components/InventoryV2/InventoryV2.js
 *
 * Chararacter Inventory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */

import htmlText from '../InventoryV3/InventoryV3.html?raw&v=inventory-full';
import cssText from '../InventoryV3/InventoryV3.css?raw&v=inventory-full';
import panelCss from '../../RpgPanel.css?raw';
import { createInventory } from '../InventoryCommon.js';

export default createInventory({
	name: 'InventoryV2',
	htmlText,
	cssText: panelCss + cssText,
	modernPanel: true,
	defaultHeight: 193,
	favoriteTab: true,
	equipSwitch: true,
	hostDropPreventDefault: true
});
