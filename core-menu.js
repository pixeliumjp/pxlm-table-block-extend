( function ( wp ) {
	'use strict';

	const { createElement: h, createPortal, useLayoutEffect, useState } = wp.element;
	const empty = { toggle: null, menu: null };

	// Core's table toolbar supplies its own controls array; it has no fill for
	// additional menu items. Render into that menu so core retains its own
	// row/column handlers, focus navigation and placement.
	window.pxlmUseCoreMenu = function useCoreMenu( clientId, enabled, groups, canvasRef ) {
		const [ target, setTarget ] = useState( empty );
		const label = wp.i18n.__( 'Edit table' );

		useLayoutEffect( () => {
			if ( ! enabled ) {
				setTarget( empty );
				return;
			}
			const documents = Array.from( new Set( [ document, canvasRef?.current?.ownerDocument ].filter( Boolean ) ) );
			const name = '[aria-label="' + CSS.escape( label ) + '"]';
			const namedButton = 'button[aria-haspopup][aria-expanded]' + name;
			// Some Toolbar slots use a plain div while others expose role=toolbar.
			const toggleSelector = namedButton + '.components-dropdown-menu__toggle:not(.pxlm-table-block-actions *)';
			const menuSelector = '[role="menu"]:not([data-pxlm-custom-menu])' + name;
			// When a toolbar button is removed it no longer matches an ancestor selector.
			const selector = namedButton + ',' + menuSelector;

			function find( selector ) {
				for ( const doc of documents ) {
					const el = doc.querySelector( selector );
					if ( el ) {
						return el;
					}
				}
				return null;
			}

			function sync() {
				const open = find( toggleSelector + '[aria-expanded="true"]' );
				const toggle = open || find( toggleSelector );
				const menu = open && find( menuSelector );
				setTarget( ( last ) => last.toggle === toggle && last.menu === menu ? last : { toggle, menu } );
			}

			// Ignore text edits and changes to unrelated controls in large posts.
			function onMutation( records ) {
				for ( const record of records ) {
					if ( record.type === 'attributes' ) {
						if ( record.target.matches( selector ) || record.oldValue === label ) {
							sync();
							return;
						}
					} else {
						for ( const node of [ ...record.addedNodes, ...record.removedNodes ] ) {
							if ( node.nodeType === 1 && ( node.matches( selector ) || node.querySelector( selector ) ) ) {
								sync();
								return;
							}
						}
					}
				}
			}

			const observers = documents.map( ( doc ) => {
				const observer = new MutationObserver( onMutation );
				observer.observe( doc.body, {
					childList: true, subtree: true, attributes: true, attributeOldValue: true,
					attributeFilter: [ 'aria-expanded', 'aria-label' ],
				} );
				return observer;
			} );
			sync();
			return () => observers.forEach( ( observer ) => observer.disconnect() );
		}, [ enabled, clientId, label, canvasRef ] );

		const { toggle, menu } = target;
		const open = enabled && toggle?.getAttribute( 'aria-expanded' ) === 'true';
		const available = enabled && Boolean( toggle ) && ( ! open || Boolean( menu ) );
		const items = open && menu ? createPortal( groups.flatMap( ( group ) =>
			group.map( ( item, i ) => h( wp.components.Button, {
				key: item.title, role: 'menuitem', 'aria-label': item.title, size: 'compact', icon: item.icon,
				className: 'components-dropdown-menu__menu-item' + ( i === 0 ? ' has-separator' : '' ),
				disabled: Boolean( item.isDisabled ), accessibleWhenDisabled: true,
				onClick( event ) {
					event.stopPropagation();
					if ( ! item.isDisabled ) {
						toggle.click();
						item.onClick();
					}
				},
				onKeyDown( event ) {
					if ( event.key === 'Escape' ) {
						event.preventDefault();
						event.stopPropagation();
						toggle.click();
						toggle.focus();
					}
				},
			}, item.title ) )
		), menu ) : null;
		return { available, items };
	};
} )( window.wp );
