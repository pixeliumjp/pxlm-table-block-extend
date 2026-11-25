( function ( wp, grid, guardNativeEdit ) {
	'use strict';

	const { createElement: h, Fragment, useCallback, useMemo, useRef, useState } = wp.element;
	const { BlockControls, useBlockEditingMode } = wp.blockEditor;
	const { Button, Modal, ToolbarDropdownMenu, ToolbarGroup } = wp.components;
	const sections = { head: 'ヘッダー', body: '本文', foot: 'フッター' };

	function cellText( content ) {
		if ( ! content ) {
			return '空欄';
		}
		const text = typeof content.toPlainText === 'function'
			? content.toPlainText()
			: wp.richText.getTextContent( wp.richText.create( { html: String( content ) } ) );
		return text.trim() || '文字のないセル';
	}

	function cellKind( cell ) {
		if ( cell.tag !== 'th' ) {
			return '通常セル';
		}
		return { row: '行見出し', col: '列見出し' }[ cell.scope ] || '見出し';
	}

	function changeType( rows, ids, tag, scope ) {
		const selected = new Set( ids );
		return rows.map( ( row, r ) => ( {
			...row,
			cells: row.cells.map( ( cell, c ) => {
				if ( ! selected.has( r + ':' + c ) ) {
					return cell;
				}
				const updated = { ...cell, tag };
				if ( scope ) {
					updated.scope = scope;
				} else {
					delete updated.scope;
				}
				return updated;
			} ),
		} ) );
	}

	function menuIcon( name ) {
		return window.pxlmTableIconBase && h( 'img', {
			src: window.pxlmTableIconBase + 'table-cell-' + name + '.svg', width: 24, height: 24, alt: '',
		} );
	}

	function cellCommands( rows, layout, ids, nested, apply ) {
		const combine = nested ? window.pxlmNestedModel.combine : undefined;
		const makeEmpty = nested ? emptyBlockCell : undefined;
		const command = ( title, enabled, run, structural = false ) => ( {
			title, isDisabled: ! enabled, onClick: () => {
				if ( enabled ) {
					apply( run(), structural );
				}
			},
		} );
		const selected = layout.valid && ids.length > 0;
		const direction = ( title, axis ) => command( title, grid.canMergeDirection( layout, ids, axis ),
			() => grid.mergeDirection( rows, ids, axis, combine, makeEmpty ), true );
		return [
			[
				command( '行見出し (th)', selected, () => changeType( rows, ids, 'th', 'row' ) ),
				command( '列見出し (th)', selected, () => changeType( rows, ids, 'th', 'col' ) ),
				command( '通常セル (td)', selected, () => changeType( rows, ids, 'td' ) ),
			],
			[
				command( 'すべて結合', grid.canMerge( layout, ids ), () => grid.merge( rows, ids, combine ), true ),
				direction( '縦方向に結合', 'vertical' ),
				direction( '横方向に結合', 'horizontal' ),
				command( '結合を解除', grid.canSplit( layout, ids ), () => grid.split( rows, ids, makeEmpty ), true ),
			],
		];
	}

	const emptyRows = [];
	function useCanvasCommands( selection, attributes, nested, apply ) {
		const rows = attributes[ selection.section ] || emptyRows;
		const layout = useMemo( () => grid.layout( rows ), [ rows ] );
		const controls = cellCommands( rows, layout, selection.ids, nested, ( updated, structural ) => {
			if ( updated ) {
				apply( selection.section, rows, updated, structural );
				if ( structural ) {
					selection.clear();
				}
			}
		} );
		const icons = [ [ 'th', 'th', 'td' ], [ '01', '02', '03', '04' ] ];
		return controls.map( ( group, i ) => group.map( ( item, j ) => ( { ...item, icon: menuIcon( icons[ i ][ j ] ) } ) ) );
	}

	function CellSelection( { section, rows, layout, apply, attributes, nested, updateTable, initialIds } ) {
		const [ selected, select ] = useState( () => new Set( initialIds ) );
		const [ anchor, setAnchor ] = useState( initialIds?.[ 0 ] ?? null );
		const byId = useMemo( () => new Map( layout.entries.map( ( entry ) => [ entry.id, entry ] ) ), [ layout ] );
		const labels = useMemo( () => new Map( layout.entries.map( ( { id, cell } ) => [ id, nested ? window.pxlmNestedModel.label( cell.content ) : cellText( cell.content ) ] ) ), [ layout, nested ] );
		const ids = Array.from( selected );
		const [ typeCommands, mergeCommands ] = cellCommands( rows, layout, ids, nested, apply );
		const commandButton = ( { title, isDisabled, onClick } ) => h( Button, { key: title, variant: 'secondary', disabled: isDisabled, onClick }, title );

		function toggle( id, shift ) {
			if ( shift && anchor !== null ) {
				select( new Set( grid.rectangle( layout.entries, anchor, id ) ) );
				return;
			}
			const next = new Set( selected );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			select( next );
			setAnchor( id );
		}

		function renderRow( row, r ) {
			return h( 'tr', { key: r }, row.cells.map( ( cell, c ) => {
				const id = r + ':' + c;
				const entry = byId.get( id );
				const label = labels.get( id );
				const kind = cellKind( cell );
				const position = ( r + 1 ) + '行 ' + ( entry.col + 1 ) + '列';
				const span = entry.width > 1 || entry.height > 1
					? '、' + entry.height + '行 × ' + entry.width + '列の結合セル'
					: '';
				return h( cell.tag === 'th' ? 'th' : 'td', {
					key: id, scope: cell.tag === 'th' ? cell.scope : undefined,
					rowSpan: entry.height, colSpan: entry.width,
				}, h( 'button', {
					type: 'button', 'aria-pressed': selected.has( id ),
					'aria-label': position + '、' + kind + span + '、' + label,
					onClick: ( event ) => toggle( id, event.shiftKey ),
				}, label, cell.tag === 'th' && h( 'small', null, kind ) ) );
			} ) );
		}

		function action( label, enabled, handler ) {
			return h( Button, { variant: 'secondary', disabled: ! enabled, onClick: handler }, label );
		}

		return h( Fragment, null,
			h( 'p', null, 'セルをクリックすると選択・解除できます。始点をクリックしてから Shift キーを押しながら終点をクリックすると、四角い範囲を選べます。' ),
			h( 'div', { className: 'pxlm-table-scroll', role: 'region', 'aria-label': sections[ section ] + 'のセル選択', tabIndex: 0 },
				h( 'table', { 'aria-label': sections[ section ] }, h( 't' + section, null, rows.map( renderRow ) ) )
			),
			h( 'div', { className: 'pxlm-table-selection' },
				h( 'span', { role: 'status' }, selected.size + ' セル選択中' ),
				action( '選択をクリア', selected.size, () => { select( new Set() ); setAnchor( null ); } )
			),
			h( 'div', { className: 'pxlm-table-actions', role: 'group', 'aria-label': 'セルの種類' },
				typeCommands.map( commandButton )
			),
			h( 'p', null, nested ? '長方形に選んだセルを結合すると、各セルのブロックが左上から行順に並びます。解除後は左上のセルに残ります。' : '隣接するセルを長方形に選ぶと結合できます。内容は左上から行順に改行でつなぎ、結合を解除したときは左上のセルに残します。' ),
			h( 'div', { className: 'pxlm-table-actions' },
				mergeCommands.map( commandButton )
			),
			nested && h( 'details', null,
				h( 'summary', null, '行・列の操作' ),
				h( 'p', null, '結合のない表で、基準となるセルを1つ選択してください。' ),
				h( 'div', { className: 'pxlm-table-actions' },
					Object.entries( dimensionLabels ).map( ( [ op, label ] ) => h( Button, {
						key: op, variant: 'secondary',
						disabled: ids.length !== 1 || ! window.pxlmTableDimensions.canChange( attributes, section, ids[ 0 ], op ),
						onClick: () => updateTable( window.pxlmTableDimensions.change( attributes, section, ids[ 0 ], op ) ),
					}, label ) )
				)
			)
		);
	}

	const dimensionLabels = {
		'row-before': '上に行を追加', 'row-after': '下に行を追加', 'row-delete': '行を削除',
		'column-before': '左に列を追加', 'column-after': '右に列を追加', 'column-delete': '列を削除',
	};

	function emptyBlockCell( { tag, scope, align } ) {
		return { tag, scope, align, content: [] };
	}

	function CellDialog( { attributes, setAttributes, onClose, nested = false, updateTable, selection } ) {
		const available = Object.keys( sections ).filter( ( key ) => attributes[ key ]?.length );
		const [ initial ] = useState( () => ( { section: selection?.section, rows: attributes[ selection?.section ], ids: selection?.ids } ) );
		const [ requested, setSection ] = useState( initial.section || 'body' );
		const section = available.includes( requested ) ? requested : available[ 0 ];
		const rows = attributes[ section ];
		const layout = useMemo( () => grid.layout( rows || [] ), [ rows ] );
		// Physical cell indices can change after a merge, split, or editor undo.
		const shape = useMemo( () => layout.entries.map( ( e ) =>
			[ e.id, e.col, e.width, e.height ].join( '/' )
		).join( ',' ), [ layout ] );

		function addSection( name ) {
			setAttributes( ( current ) => ( { [ name ]: guardNativeEdit.appendSectionRow( current, name ) } ) );
			setSection( name );
		}

		return h( Modal, { title: 'セルを編集', onRequestClose: onClose, className: 'pxlm-table-dialog' },
			! nested && h( 'div', { className: 'pxlm-table-actions' },
				h( Button, { variant: 'secondary', onClick: () => addSection( 'head' ) }, 'ヘッダー行を追加' ),
				h( Button, { variant: 'secondary', onClick: () => addSection( 'foot' ) }, 'フッター行を追加' )
			),
			available.length > 1 && h( 'label', { className: 'pxlm-table-section' }, '編集するセクション',
				h( 'select', { value: section, onChange: ( e ) => setSection( e.target.value ) },
					available.map( ( key ) => h( 'option', { key, value: key }, sections[ key ] ) )
				)
			),
			layout.valid && rows?.length ? h( CellSelection, {
				key: section + shape, section, rows, layout, attributes, nested, updateTable,
				initialIds: section === initial.section && rows === initial.rows ? initial.ids : undefined,
				apply: ( updated ) => {
					if ( updated ) {
						setAttributes( ( current ) => current[ section ] === rows ? { [ section ]: updated } : {} );
					}
				},
			} ) : h( 'p', null, 'このセクションの行と列を読み取れません。表の構造を確認してください。' ),
			h( 'div', { className: 'pxlm-table-footer' }, h( Button, { variant: 'primary', onClick: onClose }, '閉じる' ) )
		);
	}

	function TableTools( { BlockEdit, ...props } ) {
		const mode = useBlockEditingMode();
		const registry = wp.data.useRegistry();
		const [ dialogSelection, setDialogSelection ] = useState( null );
		const [ revision, setRevision ] = useState( 0 );
		const selection = window.pxlmUseCanvasSelection( props.clientId, props.attributes, { enabled: mode === 'default' && ! dialogSelection, nested: false } );
		const attributesRef = useRef( props.attributes );
		attributesRef.current = props.attributes;

		const notify = useCallback( () => {
			setRevision( ( value ) => value + 1 );
			wp.data.dispatch( 'core/notices' ).createWarningNotice(
				'本文の行や列の追加・削除、列の文字揃えを行うには、先に「セルを編集」で結合を解除してください。',
				{ type: 'snackbar', id: 'pxlm-table-structure' }
			);
		}, [] );
		const guarded = useMemo( () => guardNativeEdit(
			props.setAttributes,
			() => registry.select( wp.blockEditor.store ).getBlockAttributes( props.clientId ) ?? attributesRef.current,
			notify
		), [ props.setAttributes, props.clientId, registry, notify ] );
		const enabled = props.isSelected && mode === 'default' && Object.keys( sections ).some( ( key ) => props.attributes[ key ]?.length );

		const commands = useCanvasCommands( selection, props.attributes, false, ( section, rows, updated, structural ) => {
			props.setAttributes( ( current ) => current[ section ] === rows ? { [ section ]: updated } : {} );
			if ( structural ) {
				setRevision( ( value ) => value + 1 );
			}
		} );
		const groups = [ ...commands, [
			{ title: 'セルを編集', icon: 'editor-table', onClick: () => setDialogSelection( { section: selection.section, ids: selection.ids } ) },
			{ title: 'セルにブロックを使う', icon: 'screenoptions', onClick: () => {
				const converted = window.pxlmNestedModel.fromCore( props.attributes );
				registry.dispatch( wp.blockEditor.store ).replaceBlock( props.clientId, converted );
			} },
		] ];
		const native = window.pxlmUseCoreMenu( props.clientId, enabled, groups, selection.ref );

		return h( Fragment, null,
			h( 'span', { ref: selection.ref, hidden: true } ),
			h( BlockEdit, { ...props, key: revision, setAttributes: guarded } ),
			native.items,
			enabled && ! native.available && h( BlockControls, { group: 'other' }, h( ToolbarGroup, null,
				h( ToolbarDropdownMenu, { label: 'セル操作', icon: 'editor-table', controls: groups } )
			) ),
			enabled && dialogSelection && h( CellDialog, { selection: dialogSelection, attributes: props.attributes, setAttributes: props.setAttributes, onClose: () => setDialogSelection( null ) } )
		);
	}

	window.pxlmTableCellDialog = CellDialog;
	window.pxlmUseCanvasCommands = useCanvasCommands;

	wp.hooks.addFilter( 'editor.BlockEdit', 'pxlm-table-block-extend/cells', ( BlockEdit ) =>
		( props ) => props.name === 'core/table' ? h( TableTools, { ...props, BlockEdit } ) : h( BlockEdit, props )
	);
} )( window.wp, window.pxlmTableGrid, window.pxlmTableNativeEdit );
