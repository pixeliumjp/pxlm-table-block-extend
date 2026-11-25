( function () {
	'use strict';

	const sections = [ 'head', 'body', 'foot' ];

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
			const patch = typeof change === 'function' ? change( current ) : change;
			const touchedSections = sections.filter( ( section ) => Object.hasOwn( patch, section ) );
			if ( touchedSections.length && hasMergedCells( current ) && touchedSections.some( ( section ) =>
				changesGridOrColumnAlignment( current[ section ] || [], patch[ section ] || [] )
			) ) {
				notify();
				return;
			}
			setAttributes( patch );
		};
	};
}() );
