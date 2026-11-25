( function ( wp ) {
	'use strict';

	const sections = [ 'head', 'body', 'foot' ];
	const { createBlock, getBlockType } = wp.blocks;

	// Grid operations use the same row/cell shape as core/table. Keep the
	// source block so an edit can reuse its clientId and move its children.
	function readSections( sectionBlocks ) {
		const attributes = { head: [], body: [], foot: [] };
		for ( const section of sectionBlocks ) {
			attributes[ section.attributes.section ] = section.innerBlocks.map( ( row ) => ( {
				sourceBlock: row,
				cells: row.innerBlocks.map( ( cell ) => ( {
					...cell.attributes,
					sourceBlock: cell,
					content: cell.innerBlocks,
				} ) ),
			} ) );
		}
		return attributes;
	}

	function sameChildren( previous, next ) {
		return previous === next || ( previous.length === next.length &&
			previous.every( ( block, index ) => block === next[ index ] ) );
	}

	function sameAttributes( previous, next ) {
		const keys = Object.keys( previous );
		return keys.length === Object.keys( next ).length &&
			keys.every( ( key ) => Object.hasOwn( next, key ) && previous[ key ] === next[ key ] );
	}

	function withChildren( previous, children ) {
		return sameChildren( previous.innerBlocks, children ) ? previous : { ...previous, innerBlocks: children };
	}

	function blocksForContent( content ) {
		if ( Array.isArray( content ) ) {
			return content;
		}
		// A core cell holds inline rich text, including links, line breaks and
		// inline images. Keep its HTML intact inside a native paragraph block.
		const html = String( content ?? '' );
		return html ? [ createBlock( 'core/paragraph', { content: html } ) ] : [];
	}

	function makeCellBlocks( cells ) {
		return cells.map( ( { sourceBlock, content, ...attributes } ) => {
			const children = blocksForContent( content );
			if ( ! sourceBlock ) {
				return createBlock( 'pxlm/table-cell', attributes, children );
			}
			if ( sameAttributes( sourceBlock.attributes, attributes ) ) {
				return withChildren( sourceBlock, children );
			}
			return { ...sourceBlock, attributes, innerBlocks: children };
		} );
	}

	function writeSections( previous, attributes ) {
		const children = [];
		for ( const name of sections ) {
			const source = previous.find( ( block ) => block.attributes.section === name );
			if ( ! Object.hasOwn( attributes, name ) ) {
				if ( source ) {
					children.push( source );
				}
				continue;
			}
			const rows = attributes[ name ] || [];
			if ( ! rows.length ) {
				continue;
			}
			const rowBlocks = rows.map( ( row ) => {
				const cells = makeCellBlocks( row.cells );
				return row.sourceBlock ? withChildren( row.sourceBlock, cells ) : createBlock( 'pxlm/table-row', {}, cells );
			} );
			children.push( source ? withChildren( source, rowBlocks ) : createBlock( 'pxlm/table-section', { section: name }, rowBlocks ) );
		}
		return sameChildren( previous, children ) ? previous : children;
	}

	function fromCore( { head, body, foot, ...attributes } ) {
		const children = writeSections( [], { head, body, foot } );
		return createBlock( 'pxlm/table', attributes, children );
	}

	function combine( entries ) {
		return entries.flatMap( ( entry ) => entry.cell.content );
	}

	function blockLabel( block ) {
		const { content, text, alt, caption } = block.attributes;
		for ( const value of [ content, text, alt, caption ] ) {
			if ( typeof value?.toPlainText === 'function' ) {
				const plain = value.toPlainText().trim();
				if ( plain ) {
					return plain;
				}
			} else if ( typeof value === 'string' && value ) {
				const plain = wp.richText.getTextContent( wp.richText.create( { html: value } ) ).trim();
				if ( plain ) {
					return plain;
				}
			}
		}
		if ( block.innerBlocks.length ) {
			return block.innerBlocks.map( blockLabel ).join( ' / ' );
		}
		return getBlockType( block.name )?.title || block.name;
	}

	function label( blocks ) {
		return blocks.length ? blocks.map( blockLabel ).join( ' / ' ) : '空欄';
	}

	window.pxlmNestedModel = { readSections, writeSections, fromCore, makeCellBlocks, combine, label };
} )( window.wp );
