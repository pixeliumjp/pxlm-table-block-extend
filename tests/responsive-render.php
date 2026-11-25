<?php
/**
 * Exercise the production render filters against the WordPress HTML API.
 * Run: php -d zend.assertions=1 tests/responsive-render.php /path/to/wordpress
 */
if ( 'cli' !== PHP_SAPI ) {
	exit;
}

if ( ! isset( $argv[1] ) || ! is_file( $argv[1] . '/wp-includes/plugin.php' ) || (int) ini_get( 'zend.assertions' ) !== 1 ) {
	fwrite( STDERR, "Usage: php -d zend.assertions=1 tests/responsive-render.php /path/to/wordpress\n" );
	exit( 1 );
}
define( 'ABSPATH', $argv[1] . '/' );
define( 'WPINC', 'wp-includes' );
require ABSPATH . WPINC . '/plugin.php';
require ABSPATH . WPINC . '/compat.php';
require ABSPATH . WPINC . '/utf8.php';
require ABSPATH . WPINC . '/kses.php';
foreach ( array( 'wp-html-attribute-token', 'wp-html-span', 'wp-html-text-replacement', 'wp-html-decoder', 'wp-html-tag-processor' ) as $class ) {
	require ABSPATH . WPINC . '/html-api/class-' . $class . '.php';
}
function wp_enqueue_style( $handle ) {
	$GLOBALS['styles'][] = $handle;
}
require dirname( __DIR__ ) . '/responsive.php';
$inner = '<table><thead><tr><th scope="col" colspan="2">Header</th></tr></thead><tbody><tr><td><p>Body</p></td></tr></tbody></table><figcaption>Caption</figcaption>';
$html = '<figure class="wp-block-table is-style-stripes" style="padding:20px;">' . $inner . '</figure>';
foreach ( array( 'core/table', 'pxlm/table' ) as $name ) {
	$filter = 'render_block_' . $name;
	$args = apply_filters( 'register_block_type_args', array( 'attributes' => array( 'existing' => array( 'type' => 'string' ) ) ), $name );
	assert( count( $args['attributes'] ) === 6 );
	assert( $html === apply_filters( $filter, $html, array( 'attrs' => array() ) ) );
	assert( $html === apply_filters( $filter, $html, array( 'attrs' => array( 'pxlmDesktopWidth' => '900px', 'pxlmDesktopScroll' => 'false' ) ) ) );
	foreach ( array( '999px', '112%', '12.1em', '.85rem', '72vw', '0px' ) as $width ) {
		$attrs = array( 'pxlmDesktopScroll' => true, 'pxlmDesktopWidth' => $width, 'pxlmMobileScroll' => true, 'pxlmMobileWidth' => '99rem', 'pxlmMobileStack' => true );
		$result = apply_filters( $filter, $html, array( 'attrs' => $attrs ) );
		assert( strpos( $result, $inner ) !== false );
		$tag = new WP_HTML_Tag_Processor( $result );
		assert( $tag->next_tag( 'figure' ) );
		assert( $tag->get_attribute( 'style' ) === 'padding:20px;--pxlm-desktop-table-width:' . $width . ';--pxlm-mobile-table-width:99rem' );
		foreach ( array( 'is-style-stripes', 'wp-block-table', 'pxlm-has-desktop-width', 'pxlm-has-mobile-width', 'pxlm-stack-mobile' ) as $class ) {
			assert( $tag->has_class( $class ) );
		}
		assert( $tag->get_attribute( 'tabindex' ) === '0' );
	}
	foreach ( array( '-1rem', 'calc(10px + 5vw)', '12vh', '100px;color:red', array(), false, 1, '', '100px' . "\n", '1e8px' ) as $bad ) {
		$res = apply_filters( $filter, $html, array( 'attrs' => array( 'pxlmDesktopScroll' => true, 'pxlmDesktopWidth' => $bad ) ) );
		assert( strpos( $res, 'pxlm-has-desktop-width' ) === false && strpos( $res, '--pxlm-desktop-table-width' ) === false );
	}
}
echo "Both block types: legacy, native markup, five units, six valid lengths and ten unsupported inputs passed.\n";
