<?php
/**
 * Plugin Name:       Market Rush
 * Description:       A colourful match-3 puzzle game with 30 levels. Add the [market_rush] shortcode to any page or post.
 * Version:           1.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            The Tech Forge Ltd
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       market-rush
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MARKET_RUSH_VERSION', '1.1.0' );

/**
 * Register (but do not load) assets. They are only enqueued on pages using the shortcode.
 */
function market_rush_register_assets() {
	wp_register_style(
		'market-rush',
		plugins_url( 'assets/market-rush.css', __FILE__ ),
		array(),
		MARKET_RUSH_VERSION
	);
	wp_register_script(
		'market-rush',
		plugins_url( 'assets/market-rush.js', __FILE__ ),
		array(),
		MARKET_RUSH_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'market_rush_register_assets' );

/**
 * [market_rush] shortcode.
 *
 * Attributes:
 *   assist    "on" (default) or "off". Gentle difficulty balancing on fruit drops.
 *   max_width Board width in pixels, 240 to 720 (default 480).
 */
function market_rush_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'assist'    => 'on',
			'max_width' => '480',
		),
		$atts,
		'market_rush'
	);

	wp_enqueue_style( 'market-rush' );
	wp_enqueue_script( 'market-rush' );

	$assist    = ( 'off' === strtolower( $atts['assist'] ) ) ? 'off' : 'on';
	$max_width = min( 720, max( 240, absint( $atts['max_width'] ) ) );

	return sprintf(
		'<div class="mr-root" data-assist="%1$s" data-max-width="%2$d"><noscript>%3$s</noscript></div>',
		esc_attr( $assist ),
		$max_width,
		esc_html__( 'Market Rush needs JavaScript to play.', 'market-rush' )
	);
}
add_shortcode( 'market_rush', 'market_rush_shortcode' );
