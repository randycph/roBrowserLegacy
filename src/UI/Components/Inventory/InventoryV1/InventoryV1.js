/**
 * UI/Components/InventoryV1/InventoryV1.js
 *
 * Chararacter Inventory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */

import htmlText from '../InventoryV3/InventoryV3.html?raw&v=inventory-detail';
import cssText from '../InventoryV3/InventoryV3.css?raw&v=inventory-detail';
import panelCss from '../../RpgPanel.css?raw&v=panel-cleanup';
import { createInventory } from '../InventoryCommon.js?v=inventory-detail';

export default createInventory({
	name: 'InventoryV1',
	htmlText,
	cssText: panelCss + cssText,
	modernPanel: true,
	defaultHeight: 193,
	favoriteTab: true
});
