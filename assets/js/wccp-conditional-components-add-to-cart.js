/* global wc_cp_composite_scripts */

;( function ( $, window, document, undefined ) {

	var conditional_component_scripts = {};

	$( '.composite_data' )

		.on( 'wc-composite-initializing', function() {

			var container_id = $( this ).data( 'container_id' );

			if ( typeof( conditional_component_scripts[ container_id ] ) !== 'undefined' ) {
				return true;
			} else if ( typeof( wc_cp_composite_scripts[ container_id ] ) === 'undefined' ) {
				return false;
			} else {

				var composite = wc_cp_composite_scripts[ container_id ];

				conditional_component_scripts[ container_id ] = new WC_CP_Conditional_Components( composite );

				conditional_component_scripts[ container_id ].init();
			}

		} );

	function WC_CP_Conditional_Components ( composite ) {

		var script = this;

		this.init = function() {

			/*
			 * Init conditional visibility models.
			 */
			composite.actions.add_action( 'initialize_composite', function() {
				script.init_models();
			}, 21, this );

			/*
			 * Setup filters.
			 */
			composite.actions.add_action( 'initialize_composite', function() {
				script.add_filters();
			}, 21, this );

			/*
			 * Init conditional visibility views.
			 */
			composite.actions.add_action( 'initialize_composite', function() {
				script.init_views();
			}, 51, this );
		};

		/**
		 * Init visibility models.
		 */
		this.init_models = function() {

			var Step_Visibility_Model = function( component, opts ) {

				var self = component;

				/**
				 * Controls the visibility state of a component.
				 */
				var Model = Backbone.Model.extend( {

					initialize: function() {

						var params = {
							is_hidden: false,
						};

						this.set( params );

						if ( self.is_component() ) {

							/**
							 * Update model state when the active scenarios change.
							 */
							composite.actions.add_action( 'active_scenarios_changed', this.update_visibility_state, 15, this );

							/**
							 * Run 'step_visibility_changed' action.
							 */
							this.on( 'change:is_hidden', this.do_action, this );
						}
					},

					do_action: function() {

						/**
						 * Action 'step_visibility_changed':
						 *
						 * @hooked Step_Visibility_View::step_visibility_changed_handler - 10
						 */
						composite.actions.do_action( 'step_visibility_changed', [ self ] );
					},

					update_visibility_state: function() {

						var scenarios        = composite.scenarios.get_active_scenarios(),
							active_scenarios = composite.scenarios.filter_scenarios_by_type( scenarios, 'conditional_components' ),
							hide_component   = false;

						composite.console_log( 'debug:models', '\nUpdating "' + self.get_title() + '" visibility...' );
						composite.console_log( 'debug:models', 'Active "Hide Components" Scenarios: ' + active_scenarios.toString() );

						// Get conditional components data.
						var conditional_components = composite.scenarios.get_scenario_data().scenario_settings.conditional_components;

						// Find if the component is hidden in the active scenarios.
						if ( active_scenarios.length > 0 && typeof( conditional_components ) !== 'undefined' ) {

							// Set hide status.
							$.each( conditional_components, function( scenario_id, hidden_components ) {

								if ( _.contains( active_scenarios, scenario_id.toString() ) ) {
									if ( _.contains( hidden_components, self.component_id.toString() ) ) {
										hide_component = true;
									}
								}
							} );
						}

						composite.console_log( 'debug:models', '\nUpdating \'Step_Visibility_Model\': "' + self.get_title() + '", Attribute: "is_hidden": ' + hide_component.toString() );

						composite.debug_tab_count = composite.debug_tab_count + 2;
						this.set( { is_hidden: hide_component } );
						composite.debug_tab_count = composite.debug_tab_count - 2;
					}

				} );

				var obj = new Model( opts );
				return obj;
			};

			/*
			 * Init visibility models.
			 */
			$.each( composite.get_steps(), function( index, component ) {
				component.step_visibility_model = new Step_Visibility_Model( component );
			} );
		};

		/*
		 * Add filters:
		 *
		 * - Step access model state filter.
		 * - Step validation result filter.
		 * - Component 'is_optional' method filter.
		 * - Component validation messages filter.
		 */
		this.add_filters = function() {

			composite.filters.add_filter( 'step_is_valid', this.step_is_valid, 10, this );
			composite.filters.add_filter( 'step_is_locked', this.step_is_locked, 10, this );
			composite.filters.add_filter( 'component_is_optional', this.component_is_optional, 10, this );
			composite.filters.add_filter( 'step_validation_messages', this.step_validation_messages, 10, this );
		};

		/*
		 * Step validation messages filter.
		 */
		this.step_validation_messages = function( messages, context, step ) {

			if ( step.is_component() && step.step_visibility_model.get( 'is_hidden' ) ) {
				messages = [];
			}

			return messages;
		};

		/*
		 * Step validation result filter.
		 */
		this.step_is_valid = function( is_valid, step ) {

			if ( step.is_component() && step.step_visibility_model.get( 'is_hidden' ) ) {
				is_valid = true;
			}

			return is_valid;
		};

		/*
		 * Step access model state filter.
		 */
		this.step_is_locked = function( is_locked, step ) {

			if ( step.is_component() && step.step_visibility_model.get( 'is_hidden' ) ) {
				is_locked = true;
			}

			return is_locked;
		};

		/**
		 * Component 'is_optional' filter: Hidden components are optional.
		 */
		this.component_is_optional = function( is_optional, component ) {

			if ( component.step_visibility_model.get( 'is_hidden' ) ) {
				is_optional = true;
			}

			return is_optional;
		};

		/**
		 * Init visibility views.
		 */
		this.init_views = function() {

			var Step_Visibility_View = function( component, opts ) {

				var self = component;

				var View = Backbone.View.extend( {

					initialize: function() {

						/**
						 * Change prev/next pointers and visibility to skip hidden components:
						 *
						 * - When the visibility model state of a prev/next component changes.
						 * - When the active step changes and prev/next pointers need to be refreshed.
						 */
						composite.actions.add_action( 'step_visibility_changed', this.step_visibility_changed_handler, 10, this );
						composite.actions.add_action( 'active_step_changed', this.update_pointers, 100, this );
					},

					step_visibility_changed_handler: function( step ) {

						/**
						 * Change prev/next component pointers.
						 */
						this.update_pointers();

						/**
						 * Hide prev/next components depending on their visibility model state.
						 */
						if ( step.step_index === self.step_index ) {
							this.update_visibility();
							this.update_views();
						}

						/**
						 * Refresh numeric indexes in component markup.
						 */
						this.update_indexes();
					},

					update_indexes: function() {

						composite.console_log( 'debug:views', '\nRefreshing "' + self.get_title() + '" indexes...' );

						var hidden_count          = 0,
							summary_columns       = composite.$composite_summary.data( 'columns' ),
							summary_element_class = '',
							count                 = 1;

						// Count number of hidden components before this one.
						hidden_count = _.filter( composite.get_steps(), function( component ) {
							if ( component.step_visibility_model.get( 'is_hidden' ) && component.step_index < self.step_index ) {
								return component;
							}
						} ).length;

						count = self.step_index - hidden_count + 1;

						if ( ( ( count - 1 ) % summary_columns ) === 0 || summary_columns === 1 ) {
							summary_element_class = 'first';
						}

						if ( count % summary_columns === 0 ) {
							summary_element_class += ' last';
						}

						// Refresh index in step title.
						self.$step_title.find( '.step_index' ).html( count );

						// Refresh index in composite pagination element.
						if ( false !== composite.composite_pagination_view ) {
							composite.composite_pagination_view.view_elements[ self.step_id ].$pagination_element.find( '.element_index' ).html( count );
						}

						// Refresh index in composite summary elements.
						if ( self.is_component() ) {
							if ( false !== composite.composite_summary_view ) {
								composite.composite_summary_view.view_elements[ self.step_id ].$summary_element.removeClass( 'first last' ).addClass( summary_element_class );
								composite.composite_summary_view.view_elements[ self.step_id ].$summary_element.find( '.step_index' ).html( count );
							}

							$.each( composite.composite_summary_widget_views, function( index, widget_view ) {
								widget_view.composite_summary_view.view_elements[ self.step_id ].$summary_element.find( '.step_index' ).html( count );
							} );
						}
					},

					update_visibility: function() {

						var view = this;

						composite.console_log( 'debug:views', '\nRendering "' + self.get_title() + '" visibility...' );

						if ( false !== composite.composite_pagination_view ) {
							if ( this.model.get( 'is_hidden' ) ) {
								composite.composite_pagination_view.view_elements[ self.step_id ].$pagination_element.hide();
							} else {
								composite.composite_pagination_view.view_elements[ self.step_id ].$pagination_element.show();
							}
						}

						if ( false !== composite.composite_summary_view ) {
							if ( this.model.get( 'is_hidden' ) ) {
								composite.composite_summary_view.view_elements[ self.step_id ].$summary_element.hide();
							} else {
								composite.composite_summary_view.view_elements[ self.step_id ].$summary_element.show();
							}
						}

						$.each( composite.composite_summary_widget_views, function( index, widget_view ) {
							if ( view.model.get( 'is_hidden' ) ) {
								if ( composite.is_initialized ) {
									widget_view.composite_summary_view.view_elements[ self.step_id ].$summary_element.slideUp( 250 );
								} else {
									widget_view.composite_summary_view.view_elements[ self.step_id ].$summary_element.hide();
								}
							} else {
								if ( composite.is_initialized ) {
									widget_view.composite_summary_view.view_elements[ self.step_id ].$summary_element.slideDown( 250 );
								} else {
									widget_view.composite_summary_view.view_elements[ self.step_id ].$summary_element.show();
								}
							}
						} );

						if ( composite.settings.layout !== 'paged' ) {
							if ( this.model.get( 'is_hidden' ) ) {
								self.$el.hide();
							} else {
								self.$el.show();
							}

							if ( self.is_component() ) {
								self.component_title_view.render_navigation_state();
							}
						}
					},

					update_views: function() {

						if ( false !== composite.composite_pagination_view ) {
							composite.composite_pagination_view.render_element_state( self );
						}

						if ( false !== composite.composite_summary_view ) {
							composite.composite_summary_view.render_element_state( self );
						}

						$.each( composite.composite_summary_widget_views, function( index, widget_view ) {
							widget_view.composite_summary_view.render_element_state( self );
						} );
					},

					update_pointers: function() {

						if ( composite.settings.layout_variation === 'componentized' ) {
							return false;
						}

						var curr_step     = composite.get_current_step(),
							next_step_pre = composite.get_next_step(),
							prev_step_pre = composite.get_previous_step();

						if ( self.step_index === curr_step.step_index + 1 ) {

							// If hidden, find next closest that isn't.
							if ( self.step_visibility_model.get( 'is_hidden' ) ) {

								$.each( composite.get_steps(), function( step_index, step ) {
									if ( step_index > self.step_index ) {
										if ( step.is_review() || false === step.step_visibility_model.get( 'is_hidden' ) ) {

											var next_step_new = step;

											composite.console_log( 'debug:views', '\nChanged next component pointers to "' + step.get_title() + '".' );

											if ( false !== next_step_pre ) {
												next_step_pre._is_next = false;
												next_step_pre.$el.removeClass( 'next' );
											}

											next_step_new._is_next = true;
											next_step_new.$el.addClass( 'next' );

											return false;
										}
									}
								} );

							// If not hidden, attempt to reset.
							} else {
								if ( self.step_index !== next_step_pre.step_index ) {

									composite.console_log( 'debug:views', '\nReset next component pointers to "' + self.get_title() + '".' );

									if ( false !== next_step_pre ) {
										next_step_pre.$el.removeClass( 'next' );
										next_step_pre._is_next = false;
									}

									self.$el.addClass( 'next' );
									self._is_next = true;
								}
							}
						}

						if ( self.step_index === curr_step.step_index - 1 ) {

							// If hidden, find next closest that isn't.
							if ( self.step_visibility_model.get( 'is_hidden' ) ) {

								$.each( _.clone( composite.get_steps() ).reverse(), function( index, step ) {
									if ( step.step_index < self.step_index ) {
										if ( step.is_review() || false === step.step_visibility_model.get( 'is_hidden' ) ) {

											var prev_step_new = step;

											composite.console_log( 'debug:views', '\nChanged previous component pointers to "' + step.get_title() + '".' );

											if ( false !== prev_step_pre ) {
												prev_step_pre._is_previous = false;
												prev_step_pre.$el.removeClass( 'prev' );
											}

											prev_step_new._is_previous = true;
											prev_step_new.$el.addClass( 'prev' );

											return false;
										}
									}
								} );

							// If not hidden, attempt to reset.
							} else {
								if ( self.step_index !== prev_step_pre.step_index ) {

									composite.console_log( 'debug:views', '\nReset previous component pointers to "' + self.get_title() + '".' );

									if ( false !== prev_step_pre ) {
										prev_step_pre.$el.removeClass( 'prev' );
										prev_step_pre._is_previous = false;
									}

									self.$el.addClass( 'prev' );
									self._is_previous = true;
								}
							}
						}
					}

				} );

				var obj = new View( opts );
				return obj;
			};

			/*
			 * Init visibility views.
			 */
			$.each( composite.get_steps(), function( index, component ) {
				component.step_visibility_view = new Step_Visibility_View( component, { el: component.$el, model: component.step_visibility_model } );
			} );

			/*
			 * Prevent hidden component selections from being posted.
			 */
			composite.composite_add_to_cart_button_view.$el_button.on( 'click', function() {

				$.each( composite.get_components(), function( index, component ) {

					if ( component.step_visibility_model.get( 'is_hidden' ) ) {
						component.$component_options_select.val( '' );
					}
				} );
			} );

		};
	}

} ) ( jQuery, window, document );
