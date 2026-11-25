/* Grid coordinates are local to one table section (head, body or foot). */
( function () {
	'use strict';

	// HTML table cells are limited to these span sizes.
	const maxColSpan = 1000;
	const maxRowSpan = 65534;
	// A single pasted span can represent millions of editable DOM nodes.
	const maxNewCellsPerSplit = 50000;

	function readSpan( value, maximum ) {
		if ( value === undefined || value === null || value === '' ) {
			return 1;
		}
		if ( ! /^\d+$/.test( String( value ) ) ) {
			return null;
		}
		const span = Number( value );
		return span <= maximum ? span : null;
	}

	function layout( rows ) {
		const grid = { entries: [], width: 0, valid: Array.isArray( rows ) };
		let active = [];
		let area = 0;
		if ( ! grid.valid ) {
			return grid;
		}

		rows.forEach( ( row, rowIndex ) => {
			// Only spans started on earlier rows occupy slots before this row is laid out.
			active = active.filter( ( entry ) => entry.row + entry.height > rowIndex );
			active.sort( ( a, b ) => a.col - b.col );
			let reservation = 0;
			let col = 0;
			if ( ! row || ! Array.isArray( row.cells ) ) {
				grid.valid = false;
				return;
			}
			const newSpans = [];
			row.cells.forEach( ( cell, cellIndex ) => {
				if ( ! cell || typeof cell !== 'object' ) {
					grid.valid = false;
					return;
				}
				while ( reservation < active.length && active[ reservation ].col <= col ) {
					const occupied = active[ reservation++ ];
					col = Math.max( col, occupied.col + occupied.width );
				}
				const width = readSpan( cell.colspan, maxColSpan );
				const rawHeight = readSpan( cell.rowspan, maxRowSpan );
				// rowspan="0" extends to the end of the current row group.
				const height = rawHeight === 0 ? rows.length - rowIndex : rawHeight;
				if ( ! width || ! height || rowIndex + height > rows.length ||
					( active[ reservation ] && col + width > active[ reservation ].col ) ) {
					grid.valid = false;
				}
				const entry = {
					id: rowIndex + ':' + cellIndex,
					row: rowIndex, col, width: width || 1, height: height || 1, cell,
				};
				grid.entries.push( entry );
				if ( entry.height > 1 ) {
					newSpans.push( entry );
				}
				area += entry.width * entry.height;
				col += entry.width;
				grid.width = Math.max( grid.width, col );
			} );
			active = active.concat( newSpans );
		} );
		// Missing slots would make the rectangle ambiguous.
		grid.valid = grid.valid && area === grid.width * rows.length;
		return grid;
	}

	function bounds( entries ) {
		const rect = { left: Infinity, top: Infinity, right: 0, bottom: 0 };
		for ( const entry of entries ) {
			rect.left = Math.min( rect.left, entry.col );
			rect.top = Math.min( rect.top, entry.row );
			rect.right = Math.max( rect.right, entry.col + entry.width );
			rect.bottom = Math.max( rect.bottom, entry.row + entry.height );
		}
		return rect;
	}

	function rectangle( entries, idA, idB ) {
		const first = entries.find( ( entry ) => entry.id === idA );
		const last = entries.find( ( entry ) => entry.id === idB );
		if ( ! first || ! last ) {
			return [];
		}
		const rect = bounds( [ first, last ] );
		return entries.filter( ( entry ) => entry.col < rect.right &&
			entry.col + entry.width > rect.left && entry.row < rect.bottom &&
			entry.row + entry.height > rect.top ).map( ( entry ) => entry.id );
	}

	function selectedEntries( grid, ids ) {
		if ( ! grid.valid ) {
			return [];
		}
		const selected = new Set( ids );
		const entries = grid.entries.filter( ( entry ) => selected.has( entry.id ) );
		return entries.length === selected.size ? entries : [];
	}

	function rectangleBounds( entries ) {
		if ( entries.length < 2 ) {
			return null;
		}
		const rect = bounds( entries );
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		const area = entries.reduce( ( sum, entry ) => sum + entry.width * entry.height, 0 );
		return area === width * height ? rect : null;
	}

	function mergeBounds( entries ) {
		const rect = rectangleBounds( entries );
		return rect && rect.right - rect.left <= maxColSpan && rect.bottom - rect.top <= maxRowSpan ? rect : null;
	}

	function canMerge( grid, ids ) {
		return Boolean( mergeBounds( selectedEntries( grid, ids ) ) );
	}

	function joinRichText( entries ) {
		return entries.map( ( { cell } ) => String( cell.content ?? '' ) )
			.filter( ( html ) => html.length > 0 ).join( '<br>' );
	}

	function mergedCell( anchor, content, width, height ) {
		const cell = { ...anchor, content };
		delete cell.colspan;
		delete cell.rowspan;
		if ( width > 1 ) {
			cell.colspan = String( width );
		}
		if ( height > 1 ) {
			cell.rowspan = String( height );
		}
		return cell;
	}

	function merge( rows, ids, combine = joinRichText ) {
		const entries = selectedEntries( layout( rows ), ids );
		const rect = mergeBounds( entries );
		if ( ! rect ) {
			return null;
		}
		const anchor = entries[ 0 ];
		const merged = mergedCell( anchor.cell, combine( entries ), rect.right - rect.left, rect.bottom - rect.top );
		const selected = new Set( entries.map( ( entry ) => entry.id ) );
		return rows.map( ( row, rowIndex ) => {
			if ( rowIndex < rect.top || rowIndex >= rect.bottom ) {
				return row;
			}
			const cells = [];
			row.cells.forEach( ( cell, cellIndex ) => {
				const id = rowIndex + ':' + cellIndex;
				if ( id === anchor.id ) {
					cells.push( merged );
				} else if ( ! selected.has( id ) ) {
					cells.push( cell );
				}
			} );
			return { ...row, cells };
		} );
	}

	function directionBounds( entries, axis ) {
		const rect = rectangleBounds( entries );
		if ( ! rect || ( axis !== 'horizontal' && axis !== 'vertical' ) ) {
			return null;
		}
		const horizontal = axis === 'horizontal';
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		const span = horizontal ? width : height;
		const count = horizontal ? height : width;
		if ( span < 2 || span > ( horizontal ? maxColSpan : maxRowSpan ) ||
			count - entries.length > maxNewCellsPerSplit ) {
			return null;
		}
		// Do not offer a merge when every output row or column already exists.
		const changes = entries.some( ( entry ) => horizontal
			? entry.width !== width || entry.height !== 1
			: entry.height !== height || entry.width !== 1 );
		return changes ? rect : null;
	}

	function canMergeDirection( grid, ids, axis ) {
		return Boolean( directionBounds( selectedEntries( grid, ids ), axis ) );
	}

	function mergeDirection( rows, ids, axis, combine = joinRichText, makeEmpty = ( cell ) => ( { ...cell, content: '' } ) ) {
		const grid = layout( rows );
		const entries = selectedEntries( grid, ids );
		const rect = directionBounds( entries, axis );
		if ( ! rect ) {
			return null;
		}
		const horizontal = axis === 'horizontal';
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		const groups = Array.from( { length: horizontal ? height : width }, () => ( { entries: [], anchor: null } ) );

		for ( const entry of entries ) {
			const index = horizontal ? entry.row - rect.top : entry.col - rect.left;
			// A spanned source contributes its content once, at its original top left.
			groups[ index ].entries.push( entry );
			const onEdge = horizontal ? entry.col === rect.left : entry.row === rect.top;
			if ( onEdge ) {
				groups[ index ].anchor = entry.cell;
				const crossing = horizontal ? entry.height : entry.width;
				for ( let offset = 1; offset < crossing; offset++ ) {
					groups[ index + offset ].anchor = makeEmpty( entry.cell );
				}
			}
		}

		const byRow = Array.from( { length: height }, () => [] );
		const selected = new Set( entries.map( ( entry ) => entry.id ) );
		for ( const entry of grid.entries ) {
			if ( entry.row >= rect.top && entry.row < rect.bottom && ! selected.has( entry.id ) ) {
				byRow[ entry.row - rect.top ].push( entry );
			}
		}
		groups.forEach( ( group, index ) => {
			const cell = mergedCell( group.anchor, combine( group.entries ), horizontal ? width : 1, horizontal ? 1 : height );
			byRow[ horizontal ? index : 0 ].push( { col: horizontal ? rect.left : rect.left + index, cell } );
		} );
		return rows.map( ( row, index ) => {
			const updated = byRow[ index - rect.top ];
			return updated ? { ...row, cells: updated.sort( ( a, b ) => a.col - b.col ).map( ( entry ) => entry.cell ) } : row;
		} );
	}

	function mergedEntries( grid, ids ) {
		return selectedEntries( grid, ids ).filter( ( e ) => e.width > 1 || e.height > 1 || /^0+$/.test( e.cell.rowspan ) );
	}

	function splittable( entries ) {
		return entries.length > 0 &&
			entries.reduce( ( sum, e ) => sum + e.width * e.height - 1, 0 ) <= maxNewCellsPerSplit;
	}

	function canSplit( grid, ids ) {
		return splittable( mergedEntries( grid, ids ) );
	}

	function split( rows, ids, makeEmpty = ( cell ) => ( { ...cell, content: '' } ) ) {
		const grid = layout( rows );
		const entries = mergedEntries( grid, ids );
		if ( ! splittable( entries ) ) {
			return null;
		}
		const selected = new Set( entries.map( ( entry ) => entry.id ) );
		const byRow = rows.map( () => [] );
		for ( const entry of grid.entries ) {
			if ( ! selected.has( entry.id ) ) {
				byRow[ entry.row ].push( { col: entry.col, cell: entry.cell } );
				continue;
			}
			const cell = { ...entry.cell };
			delete cell.colspan;
			delete cell.rowspan;
			for ( let row = entry.row; row < entry.row + entry.height; row++ ) {
				for ( let col = entry.col; col < entry.col + entry.width; col++ ) {
					const isAnchor = row === entry.row && col === entry.col;
					byRow[ row ].push( { col, cell: isAnchor ? cell : makeEmpty( cell ) } );
				}
			}
		}
		return rows.map( ( row, index ) => ( {
			...row, cells: byRow[ index ].sort( ( a, b ) => a.col - b.col ).map( ( item ) => item.cell ),
		} ) );
	}

	const api = { layout, rectangle, canMerge, canSplit, canMergeDirection, merge, split, mergeDirection };
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = api;
	} else {
		window.pxlmTableGrid = api;
	}
} )();
