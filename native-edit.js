( function () {
	'use strict';

	const sections = [ 'head', 'body', 'foot' ];

	function createSectionRows( attributes, section ) {
		const grids = sections.map( ( name ) => window.pxlmTableGrid.layout( attributes[ name ] || [] ) );
		const width = Math.max( 1, ...grids.map( ( grid ) => grid.width ) );
		const cells = Array.from( { length: width }, () => section === 'head'
			? { tag: 'th', scope: 'col', content: '' }
			: { tag: 'td', content: '' } );

		// Core inherits alignment from the first row. A spanned cell is the
		// source for every visual column it covers.
		const first = grids.find( ( grid ) => grid.entries.length );
		for ( const entry of first?.entries || [] ) {
			if ( entry.row !== 0 ) {
				break;
			}
			if ( entry.cell.align ) {
				for ( let col = entry.col; col < entry.col + entry.width; col++ ) {
					cells[ col ].align = entry.cell.align;
				}
			}
		}
		return [ { cells } ];
	}

	function isNewBlankRow( rows, section ) {
		const tag = section === 'head' ? 'th' : 'td';
		return rows.length === 1 && rows[ 0 ].cells.length > 0 &&
			rows[ 0 ].cells.every( ( cell ) => cell.tag === tag && ! cell.content && ! cell.colspan && ! cell.rowspan );
	}

	function appendSectionRow( attributes, section ) {
		const existing = attributes[ section ] || [];
		const rows = existing.map( ( row, index ) => {
			// rowspan="0" covers the rest of this row group. Freeze its old
			// height so the appended row has one new cell per visual column.
			if ( ! row.cells.some( ( cell ) => /^0+$/.test( cell.rowspan ) ) ) {
				return row;
			}
			const cells = row.cells.map( ( cell ) => {
				if ( ! /^0+$/.test( cell.rowspan ) ) {
					return cell;
				}
				const updated = { ...cell };
				if ( index === existing.length - 1 ) {
					delete updated.rowspan;
				} else {
					updated.rowspan = String( existing.length - index );
				}
				return updated;
			} );
			return { ...row, cells };
		} );
		return rows.concat( createSectionRows( attributes, section ) );
	}

	function hasMergedCells( attributes ) {
		return sections.some( ( section ) =>
			( attributes[ section ] || [] ).some( ( row ) =>
				row.cells.some( ( cell ) =>
					Number( cell.colspan ) > 1 ||
					Number( cell.rowspan ) > 1 ||
					String( cell.rowspan ) === '0'
				)
			)
		);
	}

	// Core's row/column commands index the stored cells, ignoring spans.
	// Content and tag edits can still address a stored cell unambiguously.
	function changesGridOrColumnAlignment( previous, next ) {
		if ( previous === next ) {
			return false;
		}
		return previous.length !== next.length || previous.some( ( row, rowIndex ) => {
			const newRow = next[ rowIndex ];
			if ( row === newRow ) {
				return false;
			}
			return row.cells.length !== newRow.cells.length || row.cells.some( ( cell, cellIndex ) => {
				const newCell = newRow.cells[ cellIndex ];
				return cell !== newCell && (
					cell.colspan !== newCell.colspan ||
					cell.rowspan !== newCell.rowspan ||
					cell.align !== newCell.align
				);
			} );
		} );
	}

	window.pxlmTableNativeEdit = function ( setAttributes, attributesOrGetter, notify ) {
		return function ( change ) {
			// Read from the block editor store at dispatch time. Consecutive
			// RichText updates can arrive before React renders the new props.
			const current = typeof attributesOrGetter === 'function' ? attributesOrGetter() : attributesOrGetter;
			const patch = { ...( typeof change === 'function' ? change( current ) : change ) };
			const touchedSections = sections.filter( ( section ) => Object.hasOwn( patch, section ) );
			if ( touchedSections.length && hasMergedCells( current ) ) {
				for ( const section of touchedSections ) {
					const before = current[ section ] || [];
					const after = patch[ section ] || [];
					if ( section !== 'body' ) {
						// Header and footer are independent HTML row groups. Removing
						// an entire group cannot cut into a span in another group.
						if ( ! after.length ) {
							continue;
						}
						if ( ! before.length && isNewBlankRow( after, section ) ) {
							patch[ section ] = createSectionRows( current, section );
							continue;
						}
					}
					if ( changesGridOrColumnAlignment( before, after ) ) {
						notify();
						return;
					}
				}
			}
			setAttributes( patch );
		};
	};
	window.pxlmTableNativeEdit.createSectionRows = createSectionRows;
	window.pxlmTableNativeEdit.appendSectionRow = appendSectionRow;
}() );
