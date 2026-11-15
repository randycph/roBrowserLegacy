/**
 * App/PreLoader.js
 *
 * Manages the initial loading screen shown before the game engine is ready.
 * Standalone module with no project imports to avoid circular dependencies.
 */

const PRELOADER_CSS = `  
	#ro-preloader {  
		position: fixed;  
		top: 0; left: 0;  
		width: 100%; height: 100%;  
		z-index: 99999;  
		background: rgba(6, 8, 16, 0.97);  
		display: flex;  
		align-items: center;  
		justify-content: center;  
		flex-direction: column;  
		transition: opacity 0.3s ease;  
	}  
	#ro-preloader.fade-out { opacity: 0; }  
	#ro-preloader .pre-scene {
		position: relative; width: 130px; height: 130px; overflow: hidden;
	}
	#ro-preloader .pre-poring {
		position: absolute; left: 50%; top: 50%; width: 96px;
		object-fit: contain; image-rendering: pixelated;
		animation: ro-pre-bounce 1.15s ease-in-out infinite;
	}
	@keyframes ro-pre-bounce {
		0%, 100% { transform: translate(-50%, -40%) scale(1.08, 0.92); }
		50% { transform: translate(-50%, -75%) scale(0.94, 1.06); }
	}
	@media (prefers-reduced-motion: reduce) {
		#ro-preloader .pre-poring { animation: none; transform: translate(-50%, -50%); }
	}
`;

const PRELOADER_INNER_HTML =
	'<div class="pre-scene" aria-hidden="true">' +
	'<img class="pre-poring" src="/applications/pwa/assets/poring-chasing.webp" alt="" />' +
	'</div>';

export const roInitSpinner = {
	divElem: null,
	styleElem: null,

	/**
	 * Grab the pre-existing #ro-preloader from the HTML.
	 * If it doesn't exist (e.g. inside an iframe / api.html),
	 * dynamically create one with the same styling.
	 */
	add: function () {
		let el = document.getElementById('ro-preloader');
		if (!el) {
			// Inject CSS
			const style = document.createElement('style');
			style.id = 'ro-preloader-style';
			style.textContent = PRELOADER_CSS;
			// Dummy style tag so roBrowser doesn't clobber ours
			document.head.appendChild(document.createElement('style'));
			roInitSpinner.styleElem = document.head.appendChild(style);

			// Create element
			el = document.createElement('div');
			el.id = 'ro-preloader';
			el.innerHTML = PRELOADER_INNER_HTML;
			document.body.appendChild(el);
		}
		roInitSpinner.divElem = el;
	},

	/**
	 * Fade out and remove the preloader.
	 * Safe to call multiple times.
	 */
	remove: function () {
		const el = roInitSpinner.divElem;
		if (!el) return;
		el.classList.add('fade-out');
		const cleanup = () => {
			el.remove();
			roInitSpinner.divElem = null;
			if (roInitSpinner.styleElem) {
				roInitSpinner.styleElem.remove();
				roInitSpinner.styleElem = null;
			}
		};
		el.addEventListener('transitionend', cleanup);
		// Fallback if transitionend doesn't fire
		setTimeout(cleanup, 400);
	}
};

export default roInitSpinner;
