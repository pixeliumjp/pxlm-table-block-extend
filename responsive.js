( function ( wp ) {
	'use strict';

	const { createElement: h, Fragment } = wp.element;
	const { PanelBody, ToggleControl } = wp.components;
	const UnitControl = wp.components.UnitControl || wp.components.__experimentalUnitControl;
	const { InspectorControls, useBlockEditingMode } = wp.blockEditor;
	const units = [ 'px', '%', 'em', 'rem', 'vw' ].map( ( value ) => ( { value, label: value } ) );
	const widthPattern = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:px|%|em|rem|vw)$/;
	const isTable = ( name ) => name === 'core/table' || name === 'pxlm/table';

	function DisplaySettings( { attributes, setAttributes } ) {
		if ( useBlockEditingMode() !== 'default' ) {
			return null;
		}

		function scrollControls( device, label, widthLabel ) {
			const flag = 'pxlm' + device + 'Scroll';
			const width = 'pxlm' + device + 'Width';
			return h( Fragment, null,
				h( ToggleControl, { label, checked: attributes[ flag ] === true,
					onChange: ( enabled ) => setAttributes( { [ flag ]: enabled } ) } ),
				attributes[ flag ] && h( UnitControl, {
					label: widthLabel, units, min: 0, step: 'any', value: attributes[ width ] || '',
					__next40pxDefaultSize: true, placeholder: '自動',
					onChange: ( value ) => setAttributes( { [ width ]: widthPattern.test( value ) ? value : undefined } ),
				} )
			);
		}

		return h( InspectorControls, null, h( PanelBody, { title: 'レスポンシブ表示' },
			scrollControls( 'Desktop', 'デスクトップ表示でスクロールする', 'PCのテーブル幅' ),
			scrollControls( 'Mobile', 'モバイル表示でスクロールする', 'モバイルのテーブル幅' ),
			h( ToggleControl, { label: 'モバイルでは縦に並べる', checked: attributes.pxlmMobileStack === true,
				help: '画面幅が768px以下のときに各行のセルを縦に並べます。横スクロールと併用する場合は縦積みを優先します。',
				onChange: ( enabled ) => setAttributes( { pxlmMobileStack: enabled } ) } )
		) );
	}

	wp.hooks.addFilter( 'editor.BlockEdit', 'pxlm-table-block-extend/responsive-settings', ( BlockEdit ) => ( props ) =>
		isTable( props.name )
			? h( Fragment, null, h( BlockEdit, props ), props.isSelected && h( DisplaySettings, props ) )
			: h( BlockEdit, props )
	);

	wp.hooks.addFilter( 'editor.BlockListBlock', 'pxlm-table-block-extend/responsive-preview', ( Block ) => ( props ) => {
		if ( ! isTable( props.name ) ) {
			return h( Block, props );
		}
		const attrs = props.attributes;
		const wrapper = props.wrapperProps || {};
		const classes = [];
		const style = { ...wrapper.style };
		for ( const device of [ 'Desktop', 'Mobile' ] ) {
			if ( attrs[ 'pxlm' + device + 'Scroll' ] !== true ) {
				continue;
			}
			const size = device.toLowerCase();
			classes.push( 'pxlm-scroll-' + size );
			const width = attrs[ 'pxlm' + device + 'Width' ];
			if ( widthPattern.test( width ) ) {
				classes.push( 'pxlm-has-' + size + '-width' );
				style[ '--pxlm-' + size + '-table-width' ] = width;
			}
		}
		if ( attrs.pxlmMobileStack === true ) {
			classes.push( 'pxlm-stack-mobile' );
		}
		if ( ! classes.length ) {
			return h( Block, props );
		}
		const className = [ wrapper.className, ...classes ].filter( Boolean ).join( ' ' );
		return h( Block, { ...props, wrapperProps: { ...wrapper, className, style } } );
	} );
} )( window.wp );
