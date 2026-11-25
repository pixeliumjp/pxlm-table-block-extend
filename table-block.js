( function ( wp ) {
	'use strict';

	const { createElement: h, Fragment, useEffect, useMemo, useState } = wp.element;
	const { Button, DropdownMenu, PanelBody, ToggleControl } = wp.components;
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
		const [ rememberedCell, setRememberedCell ] = useState( null );
		const mode = useBlockEditingMode();
		const registry = wp.data.useRegistry();
		const { sections, childSelected, selectedCellId } = wp.data.useSelect( ( select ) => {
			const editor = select( wp.blockEditor.store );
			const selected = editor.getSelectedBlockClientId();
			const parents = selected ? [ selected, ...editor.getBlockParents( selected, true ) ] : [];
			const owner = parents.find( ( id ) => editor.getBlockName( id ) === 'pxlm/table' );
			return {
				sections: editor.getBlocks( clientId ),
				childSelected: editor.hasSelectedInnerBlock( clientId, true ),
				selectedCellId: owner === clientId && parents.find( ( id ) => editor.getBlockName( id ) === 'pxlm/table-cell' ),
			};
		}, [ clientId ] );
		const projection = useMemo( () => model.readSections( sections ), [ sections ] );
		const active = mode === 'default' && ( isSelected || childSelected );
		const selection = window.pxlmUseCanvasSelection( clientId, projection, { enabled: active && selecting && ! dialogSelection, nested: true } );
		useEffect( () => {
			if ( ! active ) {
				setSelecting( false );
				setRememberedCell( null );
			} else if ( selectedCellId ) {
				setRememberedCell( selectedCellId );
			}
		}, [ active, selectedCellId ] );
		// Clicking a figure control can select the table before the menu opens.
		// Retain the actual cell block ID, which is stable when rows move.
		function rememberCell( event ) {
			const cell = event.target.closest?.( '[data-type="pxlm/table-cell"]' );
			if ( cell && cell.closest( 'table' ) === event.currentTarget.querySelector( ':scope > table' ) ) {
				setRememberedCell( cell.getAttribute( 'data-block' ) );
			}
		}

		const props = useBlockProps( {
			ref: selection.ref, className: 'wp-block-table',
			onFocusCapture: rememberCell, onPointerDownCapture: rememberCell,
		} );
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

		const currentCellId = selectedCellId || rememberedCell;
		const single = useMemo( () => {
			if ( ! selecting && currentCellId ) {
				for ( const [ section, rows ] of Object.entries( projection ) ) {
					for ( const [ r, row ] of rows.entries() ) {
						const c = row.cells.findIndex( ( cell ) => cell.sourceBlock.clientId === currentCellId );
						if ( c >= 0 ) {
							return { section, ids: [ r + ':' + c ] };
						}
					}
				}
			}
			return null;
		}, [ selecting, currentCellId, projection ] );
		const target = single ? { ...selection, ...single } : selection;
		const commands = window.pxlmUseCanvasCommands( target, projection, true, ( section, rows, updated ) => {
			if ( projection[ section ] === rows ) {
				updateTable( { ...projection, [ section ]: updated } );
			}
		} );
		const tableCommands = [
			{ title: 'ヘッダー行を追加', icon: 'insert', onClick: () => addSection( 'head' ) },
			{ title: 'フッター行を追加', icon: 'insert', onClick: () => addSection( 'foot' ) },
			{ title: 'セルを編集', icon: 'editor-table', onClick: () => setDialogSelection( { section: target.section, ids: target.ids } ) },
		];
		const groups = [ ...commands, tableCommands.map( ( item ) => ( { ...item, label: item.title } ) ) ];

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
		h( DropdownMenu, { label: '表を編集', text: '表を編集', icon: 'editor-table', menuProps: { 'data-pxlm-custom-menu': true }, controls: groups } )
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
