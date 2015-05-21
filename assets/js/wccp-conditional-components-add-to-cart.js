;( function ( $, window, document, undefined ) {

	var conditional_component_scripts = {};

	$( '.composite_data' )

		.on( 'wc-composite-initializing', function() {

			var container_id = $(this).data( 'container_id' );

			if ( typeof( conditional_component_scripts[ container_id ] ) !== 'undefined' ) {
				return true;
			} else if ( typeof( wc_cp_composite_scripts[ container_id ] ) === 'undefined' ) {
				return false;
			} else {

				conditional_component_scripts[ container_id ] = {

					composite: wc_cp_composite_scripts[ container_id ],
					script:    this,

					init: function() {

						this.bind_event_handlers();
						this.init_hide_status();
					},

					bind_event_handlers: function() {

						var script = this;

						if ( this.composite.composite_layout === 'paged' ) {

							this.composite.$composite_form.children( '.component, .multistep' )

								.on( 'wc-composite-fire-scenario-actions', function() {

									var step_id = $( this ).data( 'item_id' );

									script.set_hide_status( step_id );

								} )

								.on( 'wc-composite-set-active-component', function() {

									var step_id = $( this ).data( 'item_id' );

									script.reset_hide_status();

								} )

								.on( 'wc-composite-ui-updated', function() {

									var step_id = $( this ).data( 'item_id' );

									script.update_ui( step_id );

								} );

						}

					},

					reset_hide_status: function() {

						var composite = this.composite;

						// Reset hide status
						composite.$composite_form.find( '.component.o-next' ).removeClass( 'o-next' );
						composite.$composite_form.find( '.component.o-prev' ).removeClass( 'o-prev' );

						$.each( composite.composite_components, function( index, component ) {
							component.set_hidden( false );
						} );

					},

					init_hide_status: function() {

						var composite = this.composite;

						$.each( composite.composite_components, function( index, component ) {

							component._is_hidden = false;

							component.is_hidden = function() {

								return component._is_hidden;
							};

							component.set_hidden = function( hidden ) {

								var component_index = parseInt( component.component_index );

								component._is_hidden = hidden;

								if ( ! hidden ) {

									if ( component.$self.hasClass( 'o-next' ) ) {
										composite.$composite_form.find( '.component.next' ).removeClass( 'next' );
										component.$self.removeClass( 'o-next' ).addClass( 'next' );
									}

									if ( component.$self.hasClass( 'o-prev' ) ) {
										composite.$composite_form.find( '.component.prev' ).removeClass( 'prev' );
										component.$self.removeClass( 'o-prev' ).addClass( 'prev' );
									}

								} else {

									var component_options_select = component.$component_options.find( 'select.component_options_select' );

									component.set_optional( true );

									if ( component_options_select.val() !== '' ) {
										component_options_select.val( '' ).change();
									}

									if ( component.get_step().is_next() ) {

										if ( composite.$composite_form.find( '.component.o-next' ).length === 0 ) {
											component.$self.addClass( 'o-next' );
										}

										component.$self.removeClass( 'next' );

										if ( isset( composite.composite_steps[ component_index + 1 ] ) ) {
											composite.composite_steps[ component_index + 1 ].get_markup().addClass( 'next' );

											//if ( wc_composite_params.script_debug === 'yes' ) {
												console.log( 'Changed next component to ' + composite.composite_steps[ component_index + 1 ].get_title() );
											//}
										}
									}

									if ( component.get_step().is_previous() ) {

										if ( composite.$composite_form.find( '.component.o-prev' ).length === 0 ) {
											component.$self.addClass( 'o-prev' );
										}

										component.$self.removeClass( 'prev' );

										var found_prev = false;
										var i          = index - 1;

										while ( ! found_prev && i >= 0 ) {

											if ( ! composite.composite_components[ i ].is_hidden() ) {
												composite.composite_components[ i ].$self.addClass( 'prev' );
												found_prev = true;

												if ( wc_composite_params.script_debug === 'yes' ) {
													console.log( 'Changed previous component to ' + composite.composite_components[ i ].get_title() );
												}
											}

											i--;
										}
									}
								}


							};


						} );
					},

					set_hide_status: function( firing_step_id ) {

						var composite   = this.composite;
						var firing_step = composite.get_step( firing_step_id );

						// Get active scenarios filtered by action = 'conditional_components'
						var active_scenarios = composite.get_active_scenarios_by_type( 'conditional_components' ).incl_current;

						if ( wc_composite_params.script_debug === 'yes' ) {
							console.log( '\nUpdating hidden components...' );
						}

						if ( wc_composite_params.script_debug === 'yes' ) {
							console.log( '\nActive "Hide Components" Scenarios: ' + active_scenarios.toString() );
						}

						// Get conditional components data
						var conditional_components = composite.get_scenario_data().scenario_settings.conditional_components;
						var hide_components        = [];

						// Reset hide status
						$.each( composite.composite_components, function( index, component ) {
							component.set_hidden( false );
						} );

						// Prepare component hide data from active scenarios
						if ( active_scenarios.length > 0 ) {

							// Set hide status
							$.each( conditional_components, function( scenario_id, hidden_components ) {

								if ( $.inArray( scenario_id.toString(), active_scenarios ) > -1 ) {

									$.each( composite.composite_components, function( index, component ) {

										if ( $.inArray( component.component_id.toString(), hidden_components ) > -1 ) {

											component.set_hidden( true );

											hide_components.push( component.component_id );
										}

									} );
								}

							} );
						}

						if ( wc_composite_params.script_debug === 'yes' ) {
							console.log( '\nHidden components: ' + hide_components.toString() );
						}

					},

					update_ui: function( firing_step_id ) {

						var composite             = this.composite;
						var hide_count            = 0;
						var firing_step           = composite.get_step( firing_step_id );
						var summary_columns       = composite.$composite_summary.data( 'columns' );

						var summary_element_class = '';
						var loop                  = 1;

						$.each( composite.composite_steps, function( index, step ) {

							if ( step.is_component() && step.get_component().is_hidden() ) {

								// Pagination
								composite.$composite_pagination.find( '.pagination_element_' + step.step_id ).hide();

								// Summary (widget will be cloned)
								composite.$composite_summary.find( '.summary_element_' + step.step_id ).hide();

								hide_count++;

							} else {
								// Pagination
								composite.$composite_pagination.find( '.pagination_element_' + step.step_id + ' .element_index' ).html( index - hide_count + 1 );
								composite.$composite_pagination.find( '.pagination_element_' + step.step_id ).show();

								// Summary (widget will be cloned)
								composite.$composite_summary.find( '.summary_element_' + step.step_id + ' .step_index' ).html( index - hide_count + 1 );
								composite.$composite_summary.find( '.summary_element_' + step.step_id ).show();
							}

							// Update Summary markup

							summary_element_class = '';
							loop = index - hide_count + 1;

							if ( ( ( loop - 1 ) % summary_columns ) == 0 || summary_columns == 1 ) {
								summary_element_class = 'first';
							}

							if ( loop % summary_columns == 0 ) {
								summary_element_class = 'last';
							}

							composite.$composite_summary.find( '.summary_element_' + step.step_id ).removeClass( 'first last' ).addClass( summary_element_class );

						} );

					}

				};

				conditional_component_scripts[ container_id ].init();
			}

		} );

		function isset( el ) {

			if ( typeof( el ) === 'undefined' ) {
				return false;
			}

			return true;
		}

} ) ( jQuery, window, document );
