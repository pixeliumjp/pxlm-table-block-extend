( function ( wp, grid ) {
	'use strict';

	const { useCallback, useLayoutEffect, useMemo, useRef, useState } = wp.element;
	const sectionNames = { THEAD: 'head', TBODY: 'body', TFOOT: 'foot' };
	const noIds = [];

	function shapeOf( rows ) {
		return rows.map( ( row ) => row.cells.map( ( cell ) =>
			( cell.rowspan ?? 1 ) + 'x' + ( cell.colspan ?? 1 )
		).join( ',' ) ).join( '/' );
	}

	function cellAtEvent( event, table ) {
		const cell = event.target.closest?.( 'td,th' );
		if ( ! cell || cell.closest( 'table' ) !== table ) {
			return null;
		}
		const row = cell.parentElement;
		const group = row.parentElement;
		if ( group.parentElement !== table || ! sectionNames[ group.tagName ] ) {
			return null;
		}
		return { section: sectionNames[ group.tagName ], id: row.sectionRowIndex + ':' + cell.cellIndex };
	}

	function choose( previous, section, id, rows, extend, toggle ) {
		const shape = shapeOf( rows );
		const sameSection = previous?.section === section && previous.shape === shape;
		if ( extend && sameSection ) {
			const ids = grid.rectangle( grid.layout( rows ).entries, previous.anchor, id );
			return { ...previous, ids };
		}
		if ( toggle && sameSection ) {
			const ids = previous.ids.includes( id )
				? previous.ids.filter( ( other ) => other !== id )
				: [ ...previous.ids, id ];
			return ids.length ? { section, ids, shape, anchor: id } : null;
		}
		return { section, ids: [ id ], shape, anchor: id };
	}

	window.pxlmUseCanvasSelection = function useCanvasSelection( clientId, attributes, { enabled, nested } ) {
		const ref = useRef( null );
		const [ table, setTable ] = useState( null );
		const [ selection, setSelection ] = useState( null );
		const clear = useCallback( () => setSelection( null ), [] );
		const registry = wp.data.useRegistry();
		const active = wp.data.useSelect( ( select ) => {
			const editor = select( wp.blockEditor.store );
			return editor.isBlockSelected( clientId ) || ( nested && editor.hasSelectedInnerBlock( clientId, true ) );
		}, [ clientId, nested ] );

		// The core edit wrapper and the editor canvas may be in different documents.
		// A mounted sibling (core) or the figure itself (nested) identifies the live canvas.
		useLayoutEffect( () => {
			const marker = ref.current;
			const figure = nested ? marker : marker?.ownerDocument.querySelector( '[data-block="' + clientId + '"]' );
			const next = enabled && figure ? figure.querySelector( ':scope > table' ) : null;
			if ( next !== table ) {
				setTable( next );
			}
		} );

		const selectedRows = attributes[ selection?.section ];
		const shape = useMemo( () => selectedRows && shapeOf( selectedRows ), [ selectedRows ] );
		const current = enabled && active && selection?.shape === shape ? selection : null;
		useLayoutEffect( () => {
			if ( selection && ! current ) {
				clear();
			}
		}, [ selection, current, clear ] );

		useLayoutEffect( () => {
			if ( ! table || ! enabled ) {
				return;
			}

			function handleEvent( event ) {
				if ( event.button !== 0 || event.altKey ) {
					return;
				}
				const hit = cellAtEvent( event, table );
				if ( ! hit || ! attributes[ hit.section ]?.length ) {
					return;
				}
				const modified = event.shiftKey || event.metaKey || event.ctrlKey;
				if ( nested || modified ) {
					// Suppress native text ranges, link activation and Gutenberg's
					// block multi-selection only for gestures that select cells.
					event.preventDefault();
					event.stopPropagation();
				}
				// On macOS, a primary Ctrl-click emits contextmenu instead of click.
				if ( event.type === 'click' || ( event.type === 'contextmenu' && event.ctrlKey ) ) {
					if ( ! nested && modified && ! registry.select( wp.blockEditor.store ).isBlockSelected( clientId ) ) {
						registry.dispatch( wp.blockEditor.store ).selectBlock( clientId );
					}
					setSelection( ( previous ) => choose( previous, hit.section, hit.id,
						attributes[ hit.section ], event.shiftKey, nested || event.metaKey || event.ctrlKey ) );
				}
			}

			const events = [ 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'contextmenu' ];
			for ( const name of events ) {
				table.addEventListener( name, handleEvent, true );
			}
			if ( nested ) {
				table.setAttribute( 'data-pxlm-selecting', '' );
			}
			return () => {
				for ( const name of events ) {
					table.removeEventListener( name, handleEvent, true );
				}
				table.removeAttribute( 'data-pxlm-selecting' );
			};
		}, [ table, enabled, nested, clientId, registry, attributes.head, attributes.body, attributes.foot ] );

		useLayoutEffect( () => {
			if ( ! table || ! current ) {
				return;
			}
			const group = { head: table.tHead, body: table.tBodies[ 0 ], foot: table.tFoot }[ current.section ];
			const marked = [];
			for ( const id of current.ids ) {
				const [ row, col ] = id.split( ':' );
				const cell = group?.rows[ row ]?.cells[ col ];
				if ( cell ) {
					cell.setAttribute( 'data-pxlm-selected-cell', '' );
					marked.push( cell );
				}
			}
			return () => marked.forEach( ( cell ) => cell.removeAttribute( 'data-pxlm-selected-cell' ) );
		}, [ table, current, selectedRows ] );

		return { ref, section: current?.section || 'body', ids: current?.ids || noIds, clear };
	};
} )( window.wp, window.pxlmTableGrid );
