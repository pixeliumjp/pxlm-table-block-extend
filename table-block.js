( function ( wp ) {
	'use strict';

	const { createElement: h, Fragment, useEffect, useMemo, useState } = wp.element;
	const { Button, PanelBody, ToggleControl } = wp.components;
	const { InspectorControls, RichText, useBlockProps, useInnerBlocksProps, useBlockEditingMode } = wp.blockEditor;
	const model = window.pxlmNestedModel;

	function tableProps( attributes ) {
		const color = wp.blockEditor.__experimentalGetColorClassesAndStyles( attributes );
		const border = wp.blockEditor.__experimentalGetBorderClassesAndStyles( attributes );
		const background = wp.blockEditor.getBackgroundClassesAndStyles?.( attributes ) || {};
		const alignment = attributes.style?.typography?.textAlign;
		const classes = [ color.className, border.className, background.className,
			attributes.hasFixedLayout && 'has-fixed-layout', alignment && 'has-text-align-' + alignment ];
		return { className: classes.filter( Boolean ).join( ' ' ) || undefined,
			style: { ...color.style, ...border.style, ...background.style } };
	}

	function TableEdit( { clientId, attributes, setAttributes, isSelected } ) {
		const [ dialogSelection, setDialogSelection ] = useState( null );
		const [ selecting, setSelecting ] = useState( false );
		const mode = useBlockEditingMode();
		const registry = wp.data.useRegistry();
		const { sections, childSelected } = wp.data.useSelect( ( select ) => {
			const editor = select( wp.blockEditor.store );
			return { sections: editor.getBlocks( clientId ), childSelected: editor.hasSelectedInnerBlock( clientId, true ) };
		}, [ clientId ] );
		const projection = useMemo( () => model.readSections( sections ), [ sections ] );
		const active = mode === 'default' && ( isSelected || childSelected );
		const selection = window.pxlmUseCanvasSelection( clientId, projection, { enabled: active && selecting && ! dialogSelection, nested: true } );
		useEffect( () => {
			if ( ! active ) {
				setSelecting( false );
			}
		}, [ active ] );
		const props = useBlockProps( { ref: selection.ref, className: 'wp-block-table' } );
		const inner = useInnerBlocksProps( tableProps( attributes ), {
			allowedBlocks: [ 'pxlm/table-section' ], templateLock: 'all', renderAppender: false,
		} );

		function updateTable( next ) {
			if ( ! next || sections !== registry.select( wp.blockEditor.store ).getBlocks( clientId ) ) {
				return;
			}
			registry.dispatch( wp.blockEditor.store ).replaceInnerBlocks( clientId, model.writeSections( sections, next ), false );
		}

		function addSection( section ) {
			const rows = window.pxlmTableNativeEdit.appendSectionRow( projection, section );
			updateTable( { ...projection, [ section ]: rows } );
		}

		function createTable() {
			const row = () => ( { cells: [ { tag: 'td', content: [] }, { tag: 'td', content: [] } ] } );
			updateTable( { head: [], body: [ row(), row() ], foot: [] } );
		}

		const controls = active && sections.length > 0 && h( 'div', {
			className: 'pxlm-table-block-actions', contentEditable: false,
			role: 'group', 'aria-label': '表の操作',
		},
		h( Button, {
			variant: 'secondary', isPressed: selecting, 'aria-pressed': selecting,
			onClick: () => {
				if ( ! selecting ) {
					registry.dispatch( wp.blockEditor.store ).selectBlock( clientId );
				}
				setSelecting( ! selecting );
			},
		}, 'セル選択' ),
		selecting && h( window.pxlmTableCanvasMenu, {
			nested: true, attributes: projection, selection,
			apply: ( section, rows, updated ) => {
				if ( projection[ section ] === rows ) {
					updateTable( { ...projection, [ section ]: updated } );
				}
			},
		} ),
		h( Button, { variant: 'secondary', onClick: () => setDialogSelection( { section: selection.section, ids: selection.ids } ) }, 'セルを編集' ),
		h( Button, { variant: 'secondary', onClick: () => addSection( 'head' ) }, 'ヘッダー行を追加' ),
		h( Button, { variant: 'secondary', onClick: () => addSection( 'foot' ) }, 'フッター行を追加' )
		);

		return h( Fragment, null,
			h( 'figure', props,
				! sections.length && h( Button, { variant: 'secondary', onClick: createTable }, '2行2列の表を作成' ),
				h( 'table', inner ),
				( active || ! RichText.isEmpty( attributes.caption ) ) && h( RichText, {
					tagName: 'figcaption', className: 'wp-element-caption', value: attributes.caption,
					placeholder: 'キャプションを追加', onChange: ( caption ) => setAttributes( { caption } ),
				} ),
				controls
			),
			h( InspectorControls, null, h( PanelBody, { title: '表の設定' },
				h( ToggleControl, { label: '列の幅を固定', checked: attributes.hasFixedLayout,
					onChange: ( hasFixedLayout ) => setAttributes( { hasFixedLayout } ) } )
			) ),
			dialogSelection && h( window.pxlmTableCellDialog, {
				attributes: projection, nested: true, updateTable, selection: dialogSelection,
				setAttributes: ( updater ) => updateTable( { ...projection, ...updater( projection ) } ),
				onClose: () => setDialogSelection( null ),
			} )
		);
	}

	wp.blocks.registerBlockType( 'pxlm/table', {
		edit: TableEdit,
		transforms: { from: [ { type: 'block', blocks: [ 'core/table' ], transform: model.fromCore } ] },
		save( { attributes } ) {
			const figure = useBlockProps.save( { className: 'wp-block-table' } );
			const inner = useInnerBlocksProps.save( tableProps( attributes ) );
			return h( 'figure', figure, h( 'table', inner ),
				! RichText.isEmpty( attributes.caption ) && h( RichText.Content, {
					tagName: 'figcaption', className: 'wp-element-caption', value: attributes.caption,
				} )
			);
		},
	} );
} )( window.wp );
