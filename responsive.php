<?php
/**
 * Responsive display settings for both table blocks.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'register_block_type_args',
	static function ( $args, $name ) {
		if ( in_array( $name, array( 'core/table', 'pxlm/table' ), true ) ) {
			foreach ( array( 'pxlmDesktopScroll', 'pxlmMobileScroll', 'pxlmMobileStack' ) as $flag ) {
				$args['attributes'][ $flag ] = array( 'type' => 'boolean', 'default' => false );
			}
			foreach ( array( 'pxlmDesktopWidth', 'pxlmMobileWidth' ) as $width ) {
				$args['attributes'][ $width ] = array( 'type' => 'string' );
			}
		}
		return $args;
	},
	10,
	2
);

add_action(
	'init',
	static function () {
		wp_register_style( 'pxlm-table-responsive', plugin_dir_url( __FILE__ ) . 'responsive.css', array(), '0.4.0' );
	}
);

add_action(
	'enqueue_block_assets',
	static function () {
		if ( is_admin() ) {
			wp_enqueue_style( 'pxlm-table-responsive' );
		}
	}
);

/**
 * Change only the outer figure at render time. The post retains the original
 * block HTML, including its captions, merges and any nested blocks.
 */
function pxlm_table_render_responsive( $html, $block ) {
	$attrs = $block['attrs'] ?? array();
	$desktop = true === ( $attrs['pxlmDesktopScroll'] ?? false );
	$mobile  = true === ( $attrs['pxlmMobileScroll'] ?? false );
	$stack   = true === ( $attrs['pxlmMobileStack'] ?? false );
	if ( ! $desktop && ! $mobile && ! $stack ) {
		return $html;
	}

	$tags = new WP_HTML_Tag_Processor( $html );
	if ( ! $tags->next_tag() || 'FIGURE' !== $tags->get_tag() ) {
		return $html;
	}

	$declarations = array();
	foreach ( array( 'desktop' => $desktop, 'mobile' => $mobile ) as $device => $scroll ) {
		if ( ! $scroll ) {
			continue;
		}
		$tags->add_class( 'pxlm-scroll-' . $device );
		$width = $attrs[ 'pxlm' . ucfirst( $device ) . 'Width' ] ?? '';
		if ( is_string( $width ) && preg_match( '/\A(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:px|%|em|rem|vw)\z/', $width ) ) {
			$tags->add_class( 'pxlm-has-' . $device . '-width' );
			$declarations[] = '--pxlm-' . $device . '-table-width:' . $width;
		}
	}
	if ( $stack ) {
		$tags->add_class( 'pxlm-stack-mobile' );
	}
	if ( ( $desktop || ( $mobile && ! $stack ) ) && null === $tags->get_attribute( 'tabindex' ) ) {
		$tags->set_attribute( 'tabindex', '0' );
	}
	if ( $declarations ) {
		$style = rtrim( (string) $tags->get_attribute( 'style' ), " \t\n\r;" );
		$tags->set_attribute( 'style', ( '' === $style ? '' : $style . ';' ) . implode( ';', $declarations ) );
	}
	wp_enqueue_style( 'pxlm-table-responsive' );
	return $tags->get_updated_html();
}

add_filter( 'render_block_core/table', 'pxlm_table_render_responsive', 10, 2 );
add_filter( 'render_block_pxlm/table', 'pxlm_table_render_responsive', 10, 2 );
