const assert = require( 'node:assert/strict' );
const test = require( 'node:test' );

global.window = { pxlmTableGrid: require( '../grid.js' ) };
require( '../native-edit.js' );

function fixture( attributes ) {
	const updates = [];
	const notices = [];
	const updateNative = window.pxlmTableNativeEdit(
		( patch ) => updates.push( patch ),
		attributes,
		() => notices.push( true )
	);
	return { updateNative, updates, notices };
}

const merged = {
	body: [
		{ cells: [ { content: 'a', colspan: '2' } ] },
		{ cells: [ { content: 'b' }, { content: 'c' } ] },
	],
	head: [],
	foot: [],
};
const plain = { body: [ merged.body[ 1 ] ], head: [], foot: [] };

test( 'unsafe row and column removals are rejected on merged tables', () => {
	const { updateNative, updates, notices } = fixture( merged );
	updateNative( { body: merged.body.slice( 0, 1 ) } );
	updateNative( ( previous ) => ( { body: previous.body.map( ( row ) => ( { cells: row.cells.slice( 1 ) } ) ) } ) );
	assert.equal( updates.length, 0 );
	assert.equal( notices.length, 2 );
} );

test( 'header and footer toggles create full-width, unmerged cells beside a combined row and column span', () => {
	const body = [
		{ cells: [ { tag: 'td', content: 'a', rowspan: '2', colspan: '2', align: 'right' }, { tag: 'td', content: 'b', align: 'left' } ] },
		{ cells: [ { tag: 'td', content: 'c' } ] },
	];
	const source = { body, head: [], foot: [] };
	for ( const [ section, tag ] of [ [ 'head', 'th' ], [ 'foot', 'td' ] ] ) {
		const { updateNative, updates, notices } = fixture( source );
		// Gutenberg sees two stored cells in the first body row and proposes
		// two new cells with alignments from physical rather than visual indices.
		const proposed = [ { cells: [
			{ tag, content: '', align: 'right' }, { tag, content: '', align: 'left' },
		] } ];
		updateNative( { [ section ]: proposed } );
		const [ patch ] = updates;
		assert.deepEqual( Object.keys( patch ), [ section ] );
		const cells = patch[ section ][ 0 ].cells;
		assert.deepEqual( cells.map( ( cell ) => cell.align ), [ 'right', 'right', 'left' ] );
		for ( const cell of cells ) {
			assert.equal( cell.tag, tag );
			assert.equal( cell.scope, section === 'head' ? 'col' : undefined );
			assert.equal( cell.content, '' );
			assert.equal( cell.colspan, undefined );
			assert.equal( cell.rowspan, undefined );
		}
		assert.equal( proposed[ 0 ].cells.length, 2 );
		assert.deepEqual( notices, [] );
	}
} );

test( 'removing a whole head or foot preserves all other groups and their spans', () => {
	const existing = { head: merged.body, body: merged.body, foot: merged.body };
	for ( const section of [ 'head', 'foot' ] ) {
		const { updateNative, updates, notices } = fixture( existing );
		updateNative( { [ section ]: [] } );
		assert.deepEqual( updates, [ { [ section ]: [] } ] );
		assert.deepEqual( notices, [] );
	}
} );

test( 'appends consecutive full-width header or footer rows with all existing spans and block identities intact', () => {
	const sourceBlock = { clientId: 'existing' };
	const content = [ { name: 'core/image', clientId: 'image' } ];
	for ( const section of [ 'head', 'foot' ] ) {
		const start = [
			{ sourceBlock, cells: [ { sourceBlock, colspan: '2', rowspan: '0', content }, { content: 'outside' } ] },
			{ cells: [ { rowspan: '0', content: 'final' } ] },
		];
		const table = { [ section ]: start };
		const rows = window.pxlmTableNativeEdit.appendSectionRow( table, section );
		assert.equal( rows.length, 3 );
		assert.deepEqual( rows[ 0 ].cells[ 0 ], { sourceBlock, colspan: '2', rowspan: '2', content } );
		assert.equal( rows[ 0 ].sourceBlock, sourceBlock );
		assert.equal( rows[ 0 ].cells[ 0 ].sourceBlock, sourceBlock );
		assert.equal( rows[ 0 ].cells[ 0 ].content, content );
		assert.equal( rows[ 0 ].cells[ 1 ], start[ 0 ].cells[ 1 ] );
		assert.equal( rows[ 1 ].cells[ 0 ].rowspan, undefined );
		assert.equal( start[ 0 ].cells[ 0 ].rowspan, '0' );
		assert.equal( window.pxlmTableGrid.layout( rows ).valid, true );
		assert.equal( rows[ 2 ].cells.length, 3 );
		assert.ok( rows[ 2 ].cells.every( ( cell ) => cell.tag === ( section === 'head' ? 'th' : 'td' ) ) );
		const next = window.pxlmTableNativeEdit.appendSectionRow( { [ section ]: rows }, section );
		assert.equal( next.length, 4 );
		assert.equal( next[ 0 ], rows[ 0 ] );
		assert.equal( window.pxlmTableGrid.layout( next ).valid, true );
	}
	assert.deepEqual(
		window.pxlmTableNativeEdit.appendSectionRow( merged, 'head' ),
		window.pxlmTableNativeEdit.createSectionRows( merged, 'head' )
	);
} );

test( 'a section toggle combined with an unsafe body change is rejected atomically', () => {
	const { updateNative, updates, notices } = fixture( merged );
	updateNative( { head: [ { cells: [ { tag: 'th', content: '' } ] } ], body: [] } );
	assert.deepEqual( updates, [] );
	assert.equal( notices.length, 1 );
} );

test( 'native column alignment and clearing it are rejected, while table-wide alignment is allowed', () => {
	const aligned = structuredClone( merged );
	aligned.body[ 1 ].cells[ 0 ].align = 'left';
	const { updateNative, updates, notices } = fixture( merged );
	updateNative( { body: aligned.body } );
	updateNative( { style: { typography: { textAlign: 'center' } } } );
	assert.equal( updates.length, 1 );
	assert.equal( notices.length, 1 );
	const reverse = fixture( aligned );
	reverse.updateNative( { body: merged.body } );
	assert.equal( reverse.notices.length, 1 );
} );

test( 'latest table context, content, caption and fixed layout are preserved', () => {
	let current = plain;
	const { updateNative, updates, notices } = fixture( () => current );
	current = merged;
	updateNative( ( latest ) => {
		assert.equal( latest, merged );
		const changed = structuredClone( latest.body );
		changed[ 1 ].cells[ 1 ].content = 'new';
		return { body: changed };
	} );
	updateNative( { caption: 'caption', hasFixedLayout: true } );
	assert.equal( updates[ 0 ].body[ 1 ].cells[ 1 ].content, 'new' );
	assert.deepEqual( updates[ 1 ], { caption: 'caption', hasFixedLayout: true } );
	assert.equal( notices.length, 0 );
} );

test( 'regular tables retain native structure changes', () => {
	const { updateNative, updates, notices } = fixture( plain );
	updateNative( { body: [] } );
	assert.deepEqual( updates, [ { body: [] } ] );
	assert.equal( notices.length, 0 );
} );

test( 'consecutive native updater functions see the last dispatched content without a rerender', () => {
	let storeAttributes = structuredClone( merged );
	let calls = 0;
	const append = ( suffix ) => ( current ) => {
		calls++;
		const newBody = structuredClone( current.body );
		newBody[ 0 ].cells[ 0 ].content += suffix;
		return { body: newBody };
	};
	const updateNative = window.pxlmTableNativeEdit(
		( patch ) => { storeAttributes = { ...storeAttributes, ...patch }; },
		() => storeAttributes,
		() => assert.fail( 'Typing was blocked' )
	);
	updateNative( append( 'b' ) );
	updateNative( append( 'c' ) );
	assert.equal( calls, 2 );
	assert.equal( storeAttributes.body[ 0 ].cells[ 0 ].content, 'abc' );
} );

test( 'rowspan=0 from existing HTML spans to the end of its section', () => {
	const existing = structuredClone( plain );
	existing.body[ 0 ].cells[ 0 ].rowspan = '0';
	const { updateNative, notices } = fixture( existing );
	updateNative( { body: [] } );
	assert.equal( notices.length, 1 );
} );
