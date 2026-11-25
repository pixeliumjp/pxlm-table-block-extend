const assert = require( 'node:assert/strict' );
const test = require( 'node:test' );
const grid = require( '../grid.js' );

let nextId = 0;
const blocks = {
	createBlock( name, attributes = {}, innerBlocks = [] ) {
		return { clientId: String( ++nextId ), name, attributes, innerBlocks };
	},
	getBlockType( name ) {
		return { title: { 'core/image': '画像' }[ name ] || name };
	},
};
global.window = { wp: { blocks } };
require( '../nested-model.js' );
const model = window.pxlmNestedModel;

test( 'converts existing formatted core cells, spans and block attributes; empty cells are ready for insertion', () => {
	const content = '<strong>料金</strong><br><a href="/fee">詳細</a>';
	const original = {
		anchor: 'fee', className: 'is-style-stripes', caption: '注記', hasFixedLayout: true,
		head: [ { cells: [ { tag: 'th', scope: 'col', colspan: '2', align: 'right', content: { toString: () => content } } ] } ],
		body: [ { cells: [ { tag: 'td', content: '1200' }, { tag: 'td', content: '' } ] } ],
	};
	const converted = model.fromCore( original );
	assert.deepEqual( converted.attributes, { anchor: 'fee', className: 'is-style-stripes', caption: '注記', hasFixedLayout: true } );
	assert.deepEqual( converted.innerBlocks.map( ( group ) => group.attributes.section ), [ 'head', 'body' ] );
	const table = model.readSections( converted.innerBlocks );
	assert.deepEqual( table.head[ 0 ].cells[ 0 ].sourceBlock.attributes, { tag: 'th', scope: 'col', colspan: '2', align: 'right' } );
	assert.equal( table.head[ 0 ].cells[ 0 ].content[ 0 ].attributes.content, content );
	assert.equal( table.head[ 0 ].cells[ 0 ].content[ 0 ].name, 'core/paragraph' );
	assert.deepEqual( table.body[ 0 ].cells[ 1 ].content, [] );
	assert.equal( model.writeSections( converted.innerBlocks, table ), converted.innerBlocks );
} );

test( 'editing one cell keeps its clientId, rich child references and untouched sections', () => {
	const image = blocks.createBlock( 'core/image', { id: 45 } );
	const table = model.fromCore( { body: [ { cells: [ { tag: 'td', content: [ image ] } ] } ],
		foot: [ { cells: [ { tag: 'td' } ] } ] } );
	const previous = table.innerBlocks;
	const { body } = model.readSections( previous );
	const before = body[ 0 ].cells[ 0 ];
	body[ 0 ].cells[ 0 ] = { ...before, tag: 'th', scope: 'row' };
	const changed = model.writeSections( previous, { body } );
	const cell = changed[ 0 ].innerBlocks[ 0 ].innerBlocks[ 0 ];
	assert.equal( cell.clientId, before.sourceBlock.clientId );
	assert.equal( cell.innerBlocks[ 0 ], image );
	assert.equal( cell.attributes.scope, 'row' );
	assert.equal( changed[ 0 ].clientId, previous[ 0 ].clientId );
	assert.equal( changed[ 1 ], previous[ 1 ] );
	assert.equal( before.sourceBlock.attributes.tag, 'td' );
} );

test( 'moves child blocks from each merged cell into the anchor without duplicating their identities', () => {
	const image = blocks.createBlock( 'core/image', { id: 45 } );
	const group = blocks.createBlock( 'core/group', {}, [ blocks.createBlock( 'core/heading', { content: '注記' } ) ] );
	const table = model.fromCore( { body: [ { cells: [ { tag: 'th', scope: 'row', content: [ image ] }, { tag: 'td', content: [ group ] } ] } ] } );
	const { body } = model.readSections( table.innerBlocks );
	const entries = grid.layout( body ).entries;
	const merged = { ...body[ 0 ].cells[ 0 ], colspan: '2', content: model.combine( entries ) };
	const next = model.writeSections( table.innerBlocks, { body: [ { ...body[ 0 ], cells: [ merged ] } ] } );
	const [ anchor ] = next[ 0 ].innerBlocks[ 0 ].innerBlocks;
	assert.equal( anchor.clientId, merged.sourceBlock.clientId );
	assert.equal( anchor.innerBlocks[ 0 ], image );
	assert.equal( anchor.innerBlocks[ 1 ], group );
	assert.deepEqual( anchor.attributes, { tag: 'th', scope: 'row', colspan: '2' } );
	assert.equal( model.label( [ image ] ), '画像' );
	assert.equal( model.label( [] ), '空欄' );
} );
