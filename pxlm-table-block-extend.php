<?php
/**
 * Plugin Name: Pxlm Table Block Extend
 * Description: テーブルのセルにブロックを挿入し、見出しの設定やセルの結合・解除ができます。
 * Version: 0.3.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function () {
		foreach ( array( 'table', 'section', 'row', 'cell' ) as $block ) {
			register_block_type( __DIR__ . '/blocks/' . $block );
		}
	}
);

add_action(
	'enqueue_block_editor_assets',
	static function () {
		$url     = plugin_dir_url( __FILE__ );
		$version = '0.3.0';
		wp_enqueue_script( 'pxlm-table-grid', $url . 'grid.js', array(), $version, true );
		wp_enqueue_script( 'pxlm-table-canvas', $url . 'canvas-selection.js', array( 'pxlm-table-grid', 'wp-data', 'wp-element', 'wp-block-editor' ), $version, true );
		wp_enqueue_script( 'pxlm-table-native-edit', $url . 'native-edit.js', array( 'pxlm-table-grid' ), $version, true );
		wp_enqueue_script( 'pxlm-table-dimensions', $url . 'dimensions.js', array(), $version, true );
		wp_enqueue_script( 'pxlm-table-model', $url . 'nested-model.js', array( 'wp-blocks', 'wp-rich-text' ), $version, true );
		wp_enqueue_script( 'pxlm-table-children', $url . 'cell-block.js', array( 'wp-blocks', 'wp-block-editor', 'wp-element', 'wp-data' ), $version, true );
		wp_enqueue_script(
			'pxlm-table-editor',
			$url . 'editor.js',
			array( 'pxlm-table-canvas', 'pxlm-table-model', 'pxlm-table-dimensions', 'pxlm-table-native-edit', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-element', 'wp-hooks', 'wp-notices', 'wp-rich-text' ),
			$version,
			true
		);
		wp_enqueue_script( 'pxlm-table-block', $url . 'table-block.js', array( 'pxlm-table-editor', 'pxlm-table-children' ), $version, true );
		wp_enqueue_style( 'pxlm-table-editor', $url . 'editor.css', array( 'wp-components' ), $version );
	}
);

add_action(
	'enqueue_block_assets',
	static function () {
		if ( is_admin() ) {
			wp_enqueue_style( 'pxlm-table-canvas', plugin_dir_url( __FILE__ ) . 'canvas-selection.css', array(), '0.3.0' );
		}
	}
);
