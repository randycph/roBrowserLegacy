/**
 * UI/Components/InventoryV0/InventoryV0.js
 *
 * Chararacter Inventory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */

import htmlText from '../InventoryV3/InventoryV3.html?raw&v=inventory-item-info';
import cssText from '../InventoryV3/InventoryV3.css?raw&v=inventory-item-info';
import panelCss from '../../RpgPanel.css?raw&v=popup-headings';
import { createInventory } from '../InventoryCommon.js?v=inventory-item-info';

export default createInventory({
	name: 'InventoryV0',
	htmlText,
	cssText: panelCss + cssText,
	modernPanel: true,
	defaultHeight: 2,
	resizableHeight: true,
	tabSprite: true
});
