const test = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const { change, canChange } = require( '../dimensions.js' );

function row( id ) {
	return {
		clientId: id,
		cells: [ 0, 1 ].map( ( n ) => ( { clientId: id + n, tag: 'td', content: [ { clientId: id + n + 'p' } ] } ) ),
	};
}

test( 'row insert/delete preserves all other sections and child block identities', () => {
	const table = { head: [ row( 'H' ) ], body: [ row( 'A' ), row( 'B' ) ], foot: [ row( 'F' ) ], caption: '表' };
	for ( const section of [ 'head', 'body', 'foot' ] ) {
		for ( const position of [ 'before', 'after' ] ) {
			const next = change( table, section, '0:1', 'row-' + position );
			assert.equal( next.caption, '表' );
			const index = Number( position === 'after' );
			const inserted = next[ section ][ index ].cells;
			assert.equal( inserted.length, 2 );
			assert.equal( inserted[ 0 ].tag, section === 'head' ? 'th' : 'td' );
			assert.equal( inserted[ 0 ].scope, section === 'head' ? 'col' : undefined );
			assert.notEqual( inserted[ 0 ].content, inserted[ 1 ].content );
			assert.equal( next[ section ][ 1 - index ], table[ section ][ 0 ] );
			const removed = change( next, section, index + ':1', 'row-delete' );
			assert.deepEqual( removed, table );
		}
	}
	assert.deepEqual( change( table, 'head', '0:0', 'row-delete' ).head, [] );
	assert.equal( table.body.length, 2 );
} );

test( 'column edits apply at the same index in all sections', () => {
	const table = { head: [ row( 'H' ) ], body: [ row( 'A' ), row( 'B' ) ], foot: [ row( 'F' ) ] };
	for ( const [ op, id, index ] of [ [ 'column-before', '0:0', 0 ], [ 'column-after', '0:1', 2 ] ] ) {
		const next = change( table, 'body', id, op );
		for ( const key of [ 'head', 'body', 'foot' ] ) {
			for ( const [ r, item ] of next[ key ].entries() ) {
				assert.equal( item.clientId, table[ key ][ r ].clientId );
				assert.equal( item.cells[ index ].tag, key === 'head' ? 'th' : 'td' );
				assert.deepEqual( item.cells[ index ].content, [] );
				assert.equal( item.cells[ index === 0 ? 1 : 0 ], table[ key ][ r ].cells[ 0 ] );
			}
		}
		assert.deepEqual( change( next, 'foot', '0:' + index, 'column-delete' ), table );
	}
} );

test( 'rejects merged, ragged, stale, invalid, and last-row/column operations', () => {
	const table = { body: [ row( 'A' ) ] };
	assert.equal( change( table, 'body', '0:0', 'row-delete' ), null );
	assert.equal( canChange( table, 'body', '0:0', 'row-after' ), true );
	assert.equal( change( change( table, 'body', '0:1', 'column-delete' ), 'body', '0:0', 'column-delete' ), null );
	for ( const args of [
		[ { ...table, head: [ { cells: [ { colspan: '2' } ] } ] }, 'body', '0:0', 'row-before' ],
		[ { ...table, foot: [ { cells: [ {}, { rowspan: '0' } ] } ] }, 'body', '0:0', 'column-after' ],
		[ { ...table, head: [ { cells: [ {} ] } ] }, 'body', '0:1', 'row-after' ],
		[ table, 'main', '0:0', 'row-after' ], [ table, 'body', '0:2', 'column-after' ],
		[ table, 'body', 'undefined', 'row-before' ], [ table, 'body', '0:0', 'row-swap' ],
	] ) {
		assert.equal( canChange( ...args ), false );
		assert.equal( change( ...args ), null );
	}
} );
