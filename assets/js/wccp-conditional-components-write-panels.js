jQuery( function($) {

	// Toggle override
	$( '#bto_scenario_data #bto_scenarios_inner' ).on( 'change', '.toggle_conditional_components input', function() {

		if ( $( this ).is( ':checked' ) ) {
			$( this ).closest( '.scenario_action_conditional_components_group' ).find( '.action_components' ).slideDown( 200 );
		} else {
			$( this ).closest( '.scenario_action_conditional_components_group' ).find( '.action_components' ).slideUp( 200 );
		}

	} );

} );
