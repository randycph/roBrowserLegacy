/**
 * UI/Components/MiniMap/MiniMapV2.js
 *
 * MiniMap UI
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import WorldMap from 'UI/Components/WorldMap/WorldMap.js';
import htmlText from './MiniMapV2.html?raw&v=modern2';
import cssText from './MiniMapV2.css?raw&v=modern2';
import { createMiniMap } from '../MiniMapCommon.js?v=modern2';

export default createMiniMap({
	name: 'MiniMapV2',
	htmlText,
	cssText,
	worldMap: WorldMap,
	townInfoToggle: true,
	coordinates: true,
	arrowShadow: true
});
