<?php
/**
 * Plugin Name: Pxlm Table Block Extend
 * Description: テーブルブロックのセルを複数選択し、見出しへの変更や結合・解除ができます。
 * Version: 0.1.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'enqueue_block_editor_assets',
	static function () {
		$url = plugin_dir_url( __FILE__ );
		wp_enqueue_script( 'pxlm-table-grid', $url . 'grid.js', array(), '0.1.0', true );
		wp_enqueue_script( 'pxlm-table-native-edit', $url . 'native-edit.js', array(), '0.1.0', true );
		wp_enqueue_script(
			'pxlm-table-editor',
			$url . 'editor.js',
			array( 'pxlm-table-grid', 'pxlm-table-native-edit', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-element', 'wp-hooks', 'wp-notices', 'wp-rich-text' ),
			'0.1.0',
			true
		);
		wp_enqueue_style( 'pxlm-table-editor', $url . 'editor.css', array( 'wp-components' ), '0.1.0' );
	}
);
