const assert = require( 'node:assert/strict' );
const test = require( 'node:test' );
const { layout, rectangle, canMerge, canSplit, canMergeDirection, merge, split, mergeDirection } = require( '../grid.js' );

function rowsOf( ...rows ) {
	return rows.map( ( cells ) => ( {
		cells: cells.map( ( cell ) => typeof cell === 'string' ? { tag: 'td', content: cell } : cell ),
	} ) );
}

test( 'merges a complete section in visual order, preserving rich HTML and the upper-left header', () => {
	const rich = { toString: () => '<a href="/x">linked</a>' };
	const rows = rowsOf( [ { tag: 'th', content: rich, scope: 'row', align: 'right' }, 'b' ], [ '', '<strong>d</strong>' ] );
	const ids = [ '1:1', '0:1', '0:0', '1:0' ];
	const merged = merge( rows, ids );
	assert.deepEqual( merged, [
		{ cells: [ { tag: 'th', scope: 'row', align: 'right', content: '<a href="/x">linked</a><br>b<br><strong>d</strong>', colspan: '2', rowspan: '2' } ] },
		{ cells: [] },
	] );
	assert.equal( rows[ 0 ].cells[ 0 ].content, rich );
	assert.equal( layout( merged ).valid, true );
	const divided = split( merged, [ '0:0' ] );
	assert.equal( divided[ 0 ].cells[ 0 ].content, merged[ 0 ].cells[ 0 ].content );
	assert.deepEqual( divided[ 1 ].cells, [
		{ tag: 'th', scope: 'row', align: 'right', content: '' },
		{ tag: 'th', scope: 'row', align: 'right', content: '' },
	] );
} );

test( 'uses visual columns with preceding vertical and horizontal spans', () => {
	const rows = rowsOf( [ { tag: 'td', content: 'a', rowspan: '2' }, 'b', 'c', 'd' ], [ { tag: 'td', content: 'e', colspan: '2' }, 'f' ] );
	const grid = layout( rows );
	assert.equal( grid.valid, true );
	assert.equal( grid.width, 4 );
	assert.deepEqual( grid.entries.map( ( e ) => e.col ), [ 0, 1, 2, 3, 1, 3 ] );
	const ids = rectangle( grid.entries, '1:0', '0:1' );
	assert.deepEqual( ids, [ '0:1', '0:2', '1:0' ] );
	assert.equal( canMerge( grid, ids ), true );
	const merged = merge( rows, ids );
	assert.equal( layout( merged ).valid, true );
	assert.deepEqual( merged[ 1 ].cells, [ rows[ 1 ].cells[ 1 ] ] );
	const divided = split( merged, [ '0:1' ] );
	assert.equal( layout( divided ).valid, true );
	assert.deepEqual( divided[ 1 ].cells.map( ( cell ) => cell.content ), [ '', '', 'f' ] );
	assert.equal( divided[ 0 ].cells[ 0 ], rows[ 0 ].cells[ 0 ] );
} );

test( 'rejects holes, nonrectangular selections, overlapping spans, stale ids, and invalid dimensions', () => {
	const rows = rowsOf( [ 'a', 'b' ], [ 'c', 'd' ] );
	for ( const ids of [ [], [ '0:0' ], [ '0:0', '1:1' ], [ '0:0', '0:1', '1:1' ], [ '0:0', '0:1', 'bad' ] ] ) {
		assert.equal( merge( rows, ids ), null );
	}
	assert.deepEqual( rectangle( layout( rows ).entries, '0:0', 'bad' ), [] );
	const malformed = [
		rowsOf( [ 'a', 'b' ], [ 'c' ] ),
		rowsOf( [ 'a', { rowspan: '2' } ], [ { colspan: '2' } ] ),
		rowsOf( [ { colspan: '1001' } ] ), rowsOf( [ { rowspan: '2' } ] ),
		rowsOf( [ { rowspan: '65535' } ] ), rowsOf( [ { colspan: '0' } ] ),
		rowsOf( [ { rowspan: 'x' } ] ), [ { cells: [ null ] } ], [ {} ], null,
	];
	for ( const input of malformed ) {
		assert.equal( layout( input ).valid, false );
		assert.equal( merge( input, [ '0:0', '0:1' ] ), null );
		assert.equal( split( input, [ '0:0' ] ), null );
	}
} );

test( 'splits multiple spans and treats rowspan=0 as extending through the section', () => {
	const rows = rowsOf( [ { rowspan: '0', content: 'x' }, { rowspan: '2', colspan: '2', content: 'y' } ], [] );
	const grid = layout( rows );
	assert.equal( grid.valid, true );
	assert.equal( grid.entries[ 0 ].height, 2 );
	assert.equal( canSplit( grid, [ '0:0', '0:1' ] ), true );
	const divided = split( rows, [ '0:0', '0:1' ] );
	assert.deepEqual( divided.map( ( row ) => row.cells.map( ( cell ) => cell.content ) ), [ [ 'x', 'y', '' ], [ '', '', '' ] ] );
	assert.equal( split( divided, [ '0:0' ] ), null );
} );

test( 'guard against expanding a hostile imported span into millions of cells', () => {
	const rows = [ { cells: [ { rowspan: '0', colspan: '1000' } ] }, ...Array.from( { length: 60 }, () => ( { cells: [] } ) ) ];
	assert.equal( layout( rows ).valid, true );
	assert.equal( split( rows, [ '0:0' ] ), null );
} );

test( 'clears a row-to-end span even in the final row', () => {
	const rows = rowsOf( [ { tag: 'td', rowspan: '0', content: 'x' } ] );
	assert.deepEqual( split( rows, [ '0:0' ] ), rowsOf( [ 'x' ] ) );
} );

test( 'directional merges produce one merged cell per row or column in visual order', () => {
	const rows = rowsOf( [ 'a', 'b', 'c' ], [ 'd', 'e', 'f' ] );
	const grid = layout( rows );
	const ids = grid.entries.map( ( entry ) => entry.id ).reverse();
	assert.equal( canMergeDirection( grid, ids, 'horizontal' ), true );
	assert.equal( canMergeDirection( grid, ids, 'vertical' ), true );
	const horizontal = mergeDirection( rows, ids, 'horizontal' );
	assert.deepEqual( horizontal, rowsOf(
		[ { tag: 'td', content: 'a<br>b<br>c', colspan: '3' } ],
		[ { tag: 'td', content: 'd<br>e<br>f', colspan: '3' } ]
	) );
	const vertical = mergeDirection( rows, ids, 'vertical' );
	assert.deepEqual( vertical, rowsOf( [ 'a<br>d', 'b<br>e', 'c<br>f' ]
		.map( ( content ) => ( { tag: 'td', content, rowspan: '2' } ) ), [] ) );
	assert.equal( canMergeDirection( layout( horizontal ), [ '0:0', '1:0' ], 'horizontal' ), false );
	assert.equal( canMergeDirection( layout( vertical ), [ '0:0', '0:1', '0:2' ], 'vertical' ), false );
	for ( const axis of [ 'horizontal', 'vertical' ] ) {
		assert.equal( mergeDirection( rows, [ '0:0', '1:1' ], axis ), null );
		assert.equal( mergeDirection( rows, [ '0:0', 'bad' ], axis ), null );
	}
	assert.equal( mergeDirection( rows, ids, 'other' ), null );
} );

test( 'repartitions crossing spans without cloning child blocks or duplicating source cell IDs', () => {
	const makeCell = ( id, extra ) => ( {
		tag: 'td', sourceBlock: { clientId: id }, content: [ { clientId: id + '-child' } ], ...extra,
	} );
	const a = makeCell( 'a', { tag: 'th', scope: 'row', align: 'right', rowspan: '0', colspan: '2' } );
	const b = makeCell( 'b' );
	const c = makeCell( 'c' );
	const rows = rowsOf( [ 'outside left', a, b, 'outside right' ], [ 'left', c, 'right' ] );
	const ids = [ '0:1', '0:2', '1:1' ];
	const combine = ( entries ) => entries.flatMap( ( { cell } ) => cell.content );
	const makeEmpty = ( { tag, scope, align } ) => ( { tag, scope, align, content: [] } );
	for ( const axis of [ 'horizontal', 'vertical' ] ) {
		const next = mergeDirection( rows, ids, axis, combine, makeEmpty );
		assert.equal( layout( next ).valid, true );
		assert.equal( layout( next ).width, 5 );
		assert.equal( next[ 0 ].cells[ 0 ], rows[ 0 ].cells[ 0 ] );
		assert.equal( next[ 1 ].cells.at( -1 ), rows[ 1 ].cells.at( -1 ) );
		const first = next[ 0 ].cells[ 1 ];
		assert.equal( first.sourceBlock, a.sourceBlock );
		const continuation = axis === 'horizontal' ? next[ 1 ].cells[ 1 ] : next[ 0 ].cells[ 2 ];
		assert.equal( continuation.sourceBlock, undefined );
		assert.equal( continuation.tag, 'th' );
		assert.equal( continuation.scope, 'row' );
		assert.equal( continuation.align, 'right' );
		if ( axis === 'horizontal' ) {
			assert.deepEqual( first.content, [ ...a.content, ...b.content ] );
			assert.deepEqual( continuation.content, c.content );
		} else {
			assert.deepEqual( first.content, a.content );
			assert.deepEqual( continuation.content, [] );
			assert.deepEqual( next[ 0 ].cells[ 3 ].content, [ ...b.content, ...c.content ] );
		}
	}
	assert.equal( a.rowspan, '0' );
	assert.equal( a.colspan, '2' );
} );
