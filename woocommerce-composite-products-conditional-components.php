<?php
/*
* Plugin Name: WooCommerce Composite Products - Conditional Components
* Plugin URI: http://www.woothemes.com/products/composite-products/
* Description: Adds a custom "Hide Components" Scenario action that can be used to conditionally hide Composite Components. Requires WooCommerce Composite Products.
* Version: 1.1.1
* Author: SomewhereWarm
* Author URI: http://somewherewarm.net/
* Developer: Manos Psychogyiopoulos
* Developer URI: http://somewherewarm.net/
*
* Text Domain: woocommerce-composite-products-conditional-components
* Domain Path: /languages/
*
* Requires at least: 3.8
* Tested up to: 4.4
*
* Copyright: © 2009-2015 Manos Psychogyiopoulos.
* License: GNU General Public License v3.0
* License URI: http://www.gnu.org/licenses/gpl-3.0.html
*/

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WC_CP_Scenario_Action_Conditional_Components {

	public static $version        = '1.1.1';
	public static $req_cp_version = '3.6.0';

	public static function plugin_url() {
		return plugins_url( basename( plugin_dir_path(__FILE__) ), basename( __FILE__ ) );
	}

	public static function plugin_path() {
		return untrailingslashit( plugin_dir_path( __FILE__ ) );
	}

	public static function init() {
		// Load plugin.
		add_action( 'plugins_loaded', __CLASS__ . '::load' );
	}

	public static function load() {

		global $woocommerce_composite_products;

		if ( ! empty( $woocommerce_composite_products ) && version_compare( $woocommerce_composite_products->version, self::$req_cp_version ) < 0 ) {
			add_action( 'admin_notices', __CLASS__ . '::cp_check_admin_notice' );
			return false;
		}

		// Admin script.
		add_filter( 'woocommerce_composite_script_dependencies', __CLASS__ . '::add_to_cart_script' );

		// Front-end script (where the magic happens).
		add_action( 'admin_enqueue_scripts', __CLASS__ . '::admin_scripts' );

		// Add qty data in scenarios.
		add_filter( 'woocommerce_composite_scenario_data', __CLASS__ . '::scenario_data', 10, 4 );

		// Add 'Hide Components' action in Scenarios.
		add_action( 'woocommerce_composite_scenario_admin_actions_html', __CLASS__ . '::actions_config', 15, 4 );

		// Save 'Hide Components' action settings.
		add_filter( 'woocommerce_composite_process_scenario_data', __CLASS__ . '::actions_save', 10, 5 );

		// Validation.
		add_filter( 'woocommerce_composite_validation_component_is_mandatory', __CLASS__ . '::validate', 10, 6 );
	}

	/**
	 * Displays a warning message if CP version check fails.
	 *
	 * @return string
	 */
	public static function cp_check_admin_notice() {

		echo '<div class="error"><p>' . sprintf( __( '<strong>WooCommerce Composite Products - Conditional Components</strong> requires Composite Products version %s or higher. Please update <strong>WooCommerce Composite Products</strong>.', 'woocommerce-composite-products-conditional-components' ), self::$req_cp_version ) . '</p></div>';
	}

	/**
	 * Οverride notice for empty selection when component is hidden.
	 *
	 * @param  boolean $is_mandatory
	 * @param  string  $component_id
	 * @param  array   $validation_data
	 * @param  array   $common_scenarios
	 * @param  array   $scenario_data
	 * @param  string  $product_id
	 * @return boolean
	 */
	public static function validate( $is_mandatory, $component_id, $validation_data, $common_scenarios, $scenario_data, $product_id ) {

		$conditional_components_scenarios = WC_CP_Scenarios::filter_scenarios_by_type( $common_scenarios, 'conditional_components', $scenario_data );

		if ( $conditional_components_scenarios ) {

			if ( ! empty( $scenario_data[ 'scenario_settings' ][ 'conditional_components' ] ) ) {

				$conditional_components = $scenario_data[ 'scenario_settings' ][ 'conditional_components' ];

				foreach ( $conditional_components as $scenario_id => $hidden_components ) {

					if ( in_array( $scenario_id, $conditional_components_scenarios ) ) {

						if ( ! empty( $hidden_components ) && in_array( $component_id, $hidden_components ) ) {
							$is_mandatory = false;
							break;
						}
					}
				}
			}
		}

		return $is_mandatory;
	}

	/**
	 * Add conditional components data in scenarios.
	 *
	 * @param  array  $scenario_data
	 * @param  array  $scenario_meta
	 * @param  array  $composite_data
	 * @param  mixed  $composite
	 * @return array
	 */
	public static function scenario_data( $scenario_data, $scenario_meta, $composite_data, $composite ) {

		if ( ! empty( $scenario_meta ) ) {

			$hidden_components_settings = array();

			foreach ( $scenario_meta as $scenario_id => $scenario_metadata ) {

				if ( isset( $scenario_metadata[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] ) && $scenario_metadata[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] === 'yes' ) {

					if ( ! empty( $scenario_metadata[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ] ) ) {

						$hidden_components_settings[ $scenario_id ] = $scenario_metadata[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ];
					}
				}
			}

			if ( ! empty( $hidden_components_settings ) ) {
				$scenario_data[ 'scenario_settings' ][ 'conditional_components' ] = $hidden_components_settings;
			}

		} else {
			$scenario_data[ 'scenario_settings' ][ 'conditional_components' ] = array();
		}

		return $scenario_data;
	}

	/**
	 * Save conditional components settings in scenarios.
	 *
	 * @param  array  $scenario_meta
	 * @param  array  $scenario_post_data
	 * @param  string $scenario_id
	 * @param  array  $composite_meta
	 * @param  string $composite_id
	 * @return array
	 */
	public static function actions_save( $scenario_meta, $scenario_post_data, $scenario_id, $composite_meta, $composite_id ) {

		global $woocommerce_composite_products;

		$composite = wc_get_product( $composite_id );

		// Save active state
		if ( ! empty( $scenario_post_data[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] ) ) {
			$scenario_meta[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] = 'yes';
		} else {
			$scenario_meta[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] = 'no';
		}

		// Save settings
		if ( ! empty( $scenario_post_data[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ] ) ) {
			$scenario_meta[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ] = $scenario_post_data[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ];
		}

		return $scenario_meta;
	}

	/**
	 * Front-end script.
	 *
	 * @param array $dependencies
	 */
	public static function add_to_cart_script( $dependencies ) {

		$suffix = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		wp_register_script( 'wccp-conditional-components', self::plugin_url() . '/assets/js/wccp-conditional-components-add-to-cart' . $suffix . '.js', array(), self::$version );

		$dependencies[] = 'wccp-conditional-components';

		return $dependencies;
	}

	/**
	 * Admin writepanel scripts.
	 *
	 * @return void
	 */
	public static function admin_scripts() {

		$suffix = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		$writepanel_dependency = 'wc_composite_writepanel';

		wp_register_script( 'wccp-conditional-components-writepanel', self::plugin_url() . '/assets/js/wccp-conditional-components-write-panels' . $suffix . '.js', array( 'jquery', 'jquery-ui-datepicker', $writepanel_dependency ), self::$version );
		wp_register_style( 'wccp-conditional-components-writepanel-css', self::plugin_url() . '/assets/css/wccp-conditional-components-write-panels.css', array( 'woocommerce_admin_styles' ), self::$version );

		// Get admin screen id
		$screen = get_current_screen();

		// WooCommerce admin pages
		if ( in_array( $screen->id, array( 'product' ) ) ) {
			wp_enqueue_script( 'wccp-conditional-components-writepanel' );
		}

		if ( in_array( $screen->id, array( 'edit-product', 'product' ) ) ) {
			wp_enqueue_style( 'wccp-conditional-components-writepanel-css' );
		}

	}

	/**
	 * Add 'Hide Components' action in Scenarios.
	 *
	 * @return void
	 */
	public static function actions_config( $id, $scenario_data, $composite_data, $product_id ) {

		$hide_components   = isset( $scenario_data[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] ) ? $scenario_data[ 'scenario_actions' ][ 'conditional_components' ][ 'is_active' ] : 'no';
		$hidden_components = ! empty( $scenario_data[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ] ) ? $scenario_data[ 'scenario_actions' ][ 'conditional_components' ][ 'hidden_components' ] : array();

		?>
		<div class="scenario_action_conditional_components_group" >
			<div class="form-field toggle_conditional_components">
				<label for="scenario_action_conditional_components_<?php echo $id; ?>">
					<?php echo __( 'Hide components', 'woocommerce-composite-products-conditional-components' ); ?>
				</label>
				<input type="checkbox" class="checkbox" <?php echo ( $hide_components === 'yes' ? ' checked="checked"' : '' ); ?> name="bto_scenario_data[<?php echo $id; ?>][scenario_actions][conditional_components][is_active]" <?php echo ( $hide_components === 'yes' ? ' value="1"' : '' ); ?> />
				<?php echo WC_CP_Core_Compatibility::wc_help_tip( __( 'Hide one or more Components when this Scenario is active.', 'woocommerce-composite-products-conditional-components' ) ); ?>
			</div>
			<div class="action_components" <?php echo ( $hide_components === 'no' ? ' style="display:none;"' : '' ); ?> >
				<select id="bto_conditional_components_ids_<?php echo $id; ?>" name="bto_scenario_data[<?php echo $id; ?>][scenario_actions][conditional_components][hidden_components][]" style="width: 75%;" class="<?php echo WC_CP_Core_Compatibility::is_wc_version_gte_2_3() ? 'wc-enhanced-select' : 'chosen_select'; ?> conditional_components_ids" multiple="multiple" data-placeholder="<?php echo __( 'Select components&hellip;', 'woocommerce-composite-products-conditional-components' ); ?>"><?php

					foreach ( $composite_data as $component_id => $component_data ) {

						$component_title = apply_filters( 'woocommerce_composite_component_title', $component_data[ 'title' ], $component_id, $product_id );

						$option_selected = in_array( $component_id, $hidden_components ) ? 'selected="selected"' : '';
						echo '<option ' . $option_selected . 'value="' . $component_id . '">' . $component_title . '</option>';
					}

				?></select>
			</div>
		</div>
		<?php
	}

}

WC_CP_Scenario_Action_Conditional_Components::init();
