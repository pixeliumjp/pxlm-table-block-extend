( function ( wp ) {
	'use strict';

	const { InnerBlocks, useBlockProps, useInnerBlocksProps } = wp.blockEditor;
	const { createElement: h } = wp.element;

	function cellProps( { tag, scope, align, colspan, rowspan } ) {
		return {
			scope: tag === 'th' ? scope : undefined,
			colSpan: colspan,
			rowSpan: rowspan,
			className: align ? 'has-text-align-' + align : undefined,
			'data-align': align,
		};
	}

	function Edit( { attributes, clientId, isSelected } ) {
		const showAppender = wp.data.useSelect( ( select ) => {
			const editor = select( wp.blockEditor.store );
			return isSelected || editor.getBlockCount( clientId ) === 0 ||
				editor.hasSelectedInnerBlock( clientId, true );
		}, [ clientId, isSelected ] );
		const props = useBlockProps( cellProps( attributes ) );
		const inner = useInnerBlocksProps( props, {
			templateLock: false,
			renderAppender: showAppender ? InnerBlocks.ButtonBlockAppender : false,
		} );
		return h( attributes.tag === 'th' ? 'th' : 'td', inner );
	}

	function save( { attributes } ) {
		const props = useBlockProps.save( cellProps( attributes ) );
		return h( attributes.tag === 'th' ? 'th' : 'td', useInnerBlocksProps.save( props ) );
	}

	wp.blocks.registerBlockType( 'pxlm/table-cell', { edit: Edit, save } );

	// In a section and row, only native table elements can be direct children.
	// Structural edits come from the table controls; the appender lives inside each cell.
	function registerStructure( name, getTag ) {
		wp.blocks.registerBlockType( name, {
			edit: function StructureEdit( { attributes } ) {
				const props = useBlockProps();
				const inner = useInnerBlocksProps( props, {
					templateLock: 'all',
					renderAppender: false,
				} );
				return h( getTag( attributes ), inner );
			},
			save( { attributes } ) {
				return h( getTag( attributes ), useInnerBlocksProps.save( useBlockProps.save() ) );
			},
		} );
	}

	registerStructure( 'pxlm/table-row', () => 'tr' );
	registerStructure( 'pxlm/table-section', ( { section } ) =>
		( { head: 'thead', foot: 'tfoot' } )[ section ] || 'tbody'
	);
} )( window.wp );
