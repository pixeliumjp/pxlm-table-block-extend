const assert = require( 'node:assert/strict' );
const test = require( 'node:test' );

global.window = {};
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

test( 'row and column removal and new sections are rejected on merged tables', () => {
	const { updateNative, updates, notices } = fixture( merged );
	updateNative( { body: merged.body.slice( 0, 1 ) } );
	updateNative( ( previous ) => ( { body: previous.body.map( ( row ) => ( { cells: row.cells.slice( 1 ) } ) ) } ) );
	updateNative( { head: plain.body } );
	assert.equal( updates.length, 0 );
	assert.equal( notices.length, 3 );
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
