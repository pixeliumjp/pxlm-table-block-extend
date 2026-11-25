( function () {
	'use strict';

	const sections = [ 'head', 'body', 'foot' ];
	const operations = [ 'row-before', 'row-after', 'row-delete', 'column-before', 'column-after', 'column-delete' ];

	function singleSpan( value ) {
		return value == null || value === '' || Number( value ) === 1;
	}

	function canChange( attrs, section, id, op ) {
		if ( ! attrs || ! sections.includes( section ) || ! operations.includes( op ) ||
			typeof id !== 'string' || ! /^(0|[1-9]\d*):(0|[1-9]\d*)$/.test( id ) ) {
			return false;
		}
		const [ row, column ] = id.split( ':' ).map( Number );
		const selected = attrs[ section ]?.[ row ]?.cells;
		if ( ! Array.isArray( selected ) || ! selected[ column ] ) {
			return false;
		}
		const width = selected.length;
		if ( ( op === 'column-delete' && width === 1 ) ||
			( op === 'row-delete' && section === 'body' && attrs.body.length === 1 ) ) {
			return false;
		}

		// Physical cell indices correspond to visual columns only in this case.
		return sections.every( ( key ) => {
			const rows = attrs[ key ] ?? [];
			return Array.isArray( rows ) && rows.every( ( item ) =>
				Array.isArray( item?.cells ) && item.cells.length === width &&
				item.cells.every( ( cell ) => cell && singleSpan( cell.colspan ) && singleSpan( cell.rowspan ) )
			);
		} );
	}

	function emptyCell( section ) {
		return section === 'head'
			? { tag: 'th', scope: 'col', content: [] }
			: { tag: 'td', content: [] };
	}

	function change( attrs, section, id, op ) {
		if ( ! canChange( attrs, section, id, op ) ) {
			return null;
		}
		const [ row, column ] = id.split( ':' ).map( Number );
		const [ axis, action ] = op.split( '-' );
		const index = ( axis === 'row' ? row : column ) + Number( action === 'after' );
		const next = { ...attrs };
		if ( axis === 'row' ) {
			const rows = [ ...attrs[ section ] ];
			if ( action === 'delete' ) {
				rows.splice( index, 1 );
			} else {
				const cells = attrs[ section ][ row ].cells.map( () => emptyCell( section ) );
				rows.splice( index, 0, { cells } );
			}
			next[ section ] = rows;
			return next;
		}

		for ( const key of sections ) {
			if ( ! attrs[ key ]?.length ) {
				continue;
			}
			next[ key ] = attrs[ key ].map( ( item ) => {
				const cells = [ ...item.cells ];
				if ( action === 'delete' ) {
					cells.splice( index, 1 );
				} else {
					cells.splice( index, 0, emptyCell( key ) );
				}
				return { ...item, cells };
			} );
		}
		return next;
	}

	const api = { canChange, change };
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = api;
	} else {
		window.pxlmTableDimensions = api;
	}
} )();
