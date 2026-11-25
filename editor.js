( function ( wp, grid, guardNativeEdit ) {
	'use strict';

	const { createElement: h, Fragment, useCallback, useMemo, useRef, useState } = wp.element;
	const { BlockControls, useBlockEditingMode } = wp.blockEditor;
	const { Button, Modal, ToolbarButton, ToolbarGroup } = wp.components;
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

	function CellSelection( { section, rows, layout, apply } ) {
		const [ selected, select ] = useState( new Set() );
		const [ anchor, setAnchor ] = useState( null );
		const byId = useMemo( () => new Map( layout.entries.map( ( entry ) => [ entry.id, entry ] ) ), [ layout ] );
		const labels = useMemo( () => new Map( layout.entries.map( ( { id, cell } ) => [ id, cellText( cell.content ) ] ) ), [ layout ] );
		const ids = Array.from( selected );

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

		function setType( tag, scope ) {
			const updated = rows.map( ( row, r ) => ( {
				...row,
				cells: row.cells.map( ( cell, c ) => {
					if ( ! selected.has( r + ':' + c ) ) {
						return cell;
					}
					const updatedCell = { ...cell, tag };
					if ( scope ) {
						updatedCell.scope = scope;
					} else {
						delete updatedCell.scope;
					}
					return updatedCell;
				} ),
			} ) );
			apply( updated );
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
				action( '行見出し (th)', selected.size, () => setType( 'th', 'row' ) ),
				action( '列見出し (th)', selected.size, () => setType( 'th', 'col' ) ),
				action( '通常セル (td)', selected.size, () => setType( 'td' ) )
			),
			h( 'p', null, '隣接するセルを長方形に選ぶと結合できます。内容は左上から行順に改行でつなぎ、結合を解除したときは左上のセルに残します。' ),
			h( 'div', { className: 'pxlm-table-actions' },
				action( '結合', grid.canMerge( layout, ids ), () => apply( grid.merge( rows, ids ) ) ),
				action( '結合を解除', grid.canSplit( layout, ids ), () => apply( grid.split( rows, ids ) ) )
			)
		);
	}

	function CellDialog( { attributes, setAttributes, onClose } ) {
		const available = Object.keys( sections ).filter( ( key ) => attributes[ key ]?.length );
		const [ requested, setSection ] = useState( 'body' );
		const section = available.includes( requested ) ? requested : available[ 0 ];
		const rows = attributes[ section ];
		const layout = useMemo( () => grid.layout( rows || [] ), [ rows ] );
		// Physical cell indices can change after a merge, split, or editor undo.
		const shape = useMemo( () => layout.entries.map( ( e ) =>
			[ e.id, e.col, e.width, e.height ].join( '/' )
		).join( ',' ), [ layout ] );

		return h( Modal, { title: 'セルを編集', onRequestClose: onClose, className: 'pxlm-table-dialog' },
			available.length > 1 && h( 'label', { className: 'pxlm-table-section' }, '編集するセクション',
				h( 'select', { value: section, onChange: ( e ) => setSection( e.target.value ) },
					available.map( ( key ) => h( 'option', { key, value: key }, sections[ key ] ) )
				)
			),
			layout.valid && rows?.length ? h( CellSelection, {
				key: section + shape, section, rows, layout,
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
		const [ open, setOpen ] = useState( false );
		const [ revision, setRevision ] = useState( 0 );
		const attributesRef = useRef( props.attributes );
		attributesRef.current = props.attributes;

		const notify = useCallback( () => {
			setRevision( ( value ) => value + 1 );
			wp.data.dispatch( 'core/notices' ).createWarningNotice(
				'行・列の構成や列の配置を変えるには、先に「セルを編集」で結合を解除してください。',
				{ type: 'snackbar', id: 'pxlm-table-structure' }
			);
		}, [] );
		const guarded = useMemo( () => guardNativeEdit(
			props.setAttributes,
			() => registry.select( wp.blockEditor.store ).getBlockAttributes( props.clientId ) ?? attributesRef.current,
			notify
		), [ props.setAttributes, props.clientId, registry, notify ] );
		const enabled = props.isSelected && mode === 'default' && Object.keys( sections ).some( ( key ) => props.attributes[ key ]?.length );

		return h( Fragment, null,
			h( BlockEdit, { ...props, key: revision, setAttributes: guarded } ),
			enabled && h( BlockControls, { group: 'other' }, h( ToolbarGroup, null,
				h( ToolbarButton, { onClick: () => setOpen( true ) }, 'セルを編集' )
			) ),
			enabled && open && h( CellDialog, { attributes: props.attributes, setAttributes: props.setAttributes, onClose: () => setOpen( false ) } )
		);
	}

	wp.hooks.addFilter( 'editor.BlockEdit', 'pxlm-table-block-extend/cells', ( BlockEdit ) =>
		( props ) => props.name === 'core/table' ? h( TableTools, { ...props, BlockEdit } ) : h( BlockEdit, props )
	);
} )( window.wp, window.pxlmTableGrid, window.pxlmTableNativeEdit );
