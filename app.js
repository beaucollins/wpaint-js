/*
	TODO: User authentication
*/
var blog_id = "0",
		username = "user",
		password = "wordpress",
		endpoint = "http://collins.local/~beaucollins/wp/xmlrpc.php";
/*
	namespace for all of our application specific code
*/
var wpaint = ( function( endpoint, blog_id, username, password ){
	// Namespace to define all of our application objects
	var app = {},
			// namespace for views
			ui = app.ui = {},
			// namespace for models
			model = app.model = {},
			// namespace for XML-RPC api
			client = app.api = new xmlrpc.Client( endpoint );

	// View for mainting the drawing canvas
	ui.Canvas = Backbone.View.extend( {
		events: {
			'mousedown': 'startDrawing',
			'mouseup': 'stopDrawing',
			'mousemove': 'draw',
			'resize': 'resize'
		},
		/*
			Construct the <canvas> element we'll use for drawing
		*/
		initialize: function(){
			// create the <canvas> element and start it in the center of the page
			this.$canvas = $( '<canvas></canvas>' ).css( {
				left: Math.round( 0.5 * this.$el.width() ),
				top: Math.round( 0.5 * this.$el.height() ),
				visibility: 'hidden'
			} ).appendTo( this.$el );
			// register the the resize listener for the window
			$( window ).on( 'resize', _.debounce( _.bind( this.resize, this ), 10 )  );
		},
		/*
			Called when the window is resized to center the canvas
		*/
		resize: function( e ){
			this.centerCanvas();
		},
		/*
			Centers the <canvas> within the view
		*/
		centerCanvas: function(){
			var w = this.$el.width(),
				h = this.$el.height(),
				$canvas = this.$canvas;

			this.$canvas.css( {
				// if container <div> is wider than <canvas>, center the canvas horizontally
				left: $canvas.width() > w ? 0 : ( w - $canvas.width() ) * 0.5,
				// if container <div> is taller than <canvas>, center the canvas vertically
				top: $canvas.height() > h ? 0 : ( h - $canvas.height() ) * 0.5
			} );
		},
		/*
			Creates a new MediaItem using the <canvas> base64 data
			triggers "saved" event with the new MediaItem
		*/
		saveImage: function(){
			// retrive the data uri, e.g. data:image/png;base64,oi3i9030ifjsad...
			var uri = this.$canvas[0].toDataURL(),
				// get the mime type (between ":" and ";")
				type = uri.substring( uri.indexOf( ":" ) + 1 , uri.indexOf( ";" ) ),
				// get the base64 data (eveything after the comma)
				bits = uri.substring( uri.indexOf( "," ) + 1 ),
				// struct for mw.newMediaItem
				struct = {
					type: type,
					bits: bits,
					// add the filetype so WordPress will accept it
					name: this.model.getTitle().replace( /\./g, '-' ) + '.png'
				};
			// save the new data
			client.newMediaItem( struct, _.bind( function( error, response ){
				if ( !error ) {
					// instantiate a new MediaItem with the id and current date
					// so it sorts correctly
					var item = new model.MediaItem( {
						attachment_id: response.id,
						date_created_gmt: new Date
					} );
					// fetch the attachment's data
					item.fetch();
					// notify that the image data has been saved
					this.trigger( 'saved', item );
				};
			}, this ) );
		},
		/*
			Set a new MediaItem for the canvas to display
		*/
		setModel: function( mediaItem ){
			// set the view's model
			this.model = mediaItem;
			// get reference to underlying <canvas> element
			var canvas = this.$canvas[0],
					// the the drawing context for the canvas
					context = this.context = canvas.getContext( '2d' );
				
			// create a new image to load the mediaItem's URL
			var img = new Image();
			// listen for img.onload and bind to View instance
			img.onload = _.bind( function(){
				canvas.width = img.width;
				canvas.height = img.height;
				context.drawImage( img, 0, 0, img.width, img.height );
				this.$canvas.css( 'visibility', 'visible' );
				this.centerCanvas();
			}, this );
			// load the img src, onload is called when the img is ready
			img.src = mediaItem.getSrc();
		},
		/*
			mousedown event callback
		*/
		startDrawing: function( e ){
			e.preventDefault();
			this.context.beginPath();
			this.context.lineWidth = 3.5;
			this.context.strokeStyle = 'hsl( 0, 100%, 50% )';
			this.drawing = true;
		},
		/*
			mouseup event callback
		*/
		stopDrawing: function(){
			this.drawing = false;
		},
		/*
			mousemove event callback
		*/
		draw: function( event ){
			if ( this.drawing ) {
				var offset = this.$canvas.offset();
				this.context.lineTo( event.pageX - offset.left, event.pageY - offset.top );
				this.context.stroke();
			};
		}
	} );

	/*
		View for managing the toolbar (div.toolbar). Currently only a single button.
	*/
	ui.Toolbar = Backbone.View.extend( {
		events: {
			'click a[href="#save"]': 'saveImage'
		},
		initialize: function(){
			this.render();
		},
		setModel: function( model ){
			this.model = model;
			this.render();
		},
		saveImage: function( e ){
			e.preventDefault();
			this.trigger( 'save' );
		},
		/*
			Toolbar is only enabled if it has a model
		*/
		enabled: function(){
			return !!this.model;
		},
		render: function(){
			this.$el.toggleClass( 'enabled', this.enabled() );
		}
	} );

	// View that is bound to model.MediaLibrary and displays a list of media items
	// TODO: Excercise 2
	// listen for a selection change on a MediaItem and trigger a selection event
	ui.LibraryList = Backbone.View.extend( {
		className: 'media-library',
		initialize: function(){
			this.model.fetch();
		},
		// TODO: Excercise 2
		// create a new ui.LibraryThumb for the added item and add it to the DOM
		addItem: function( item, library, options ){
		}
	} );

	// TODO: Excercise 3
	// set up a click event and and have it set the model as selected
	ui.LibraryThumb = Backbone.View.extend( {
		className: 'media-thumb',
		initialize: function(){
			this.$img = $( '<img />' ).appendTo( this.$el );
			// listen for the model change
			this.model.on( 'change', this.render, this );
			this.render();
		},
		// TODO: Excercise 2
		// set the img's src with the model's src toggle the "selected" class
		// if the model is selected
		render: function(){
		}
	} );

	// TODO: Media Item model to represent a WP Media Item that syncs over XML-RPC
	// and is managed by the MediaLibrary collection
	model.MediaItem = Backbone.Model.extend( {
		// Tell the Model that the unique for this model is stored in the attachment_id property
		idAttribute: 'attachment_id',
		// Sync the item of XML-RPC
		getDateCreated: function( a, b ){
			return Date.parse( this.get( 'date_created_gmt' ) );
		},
		getSrc: function(){
			return this.get( 'link' );
		},
		getThumbnailSrc: function(){
			return this.get( 'thumbnail' );
		},
		getTitle: function(){
			return this.get( 'title' );
		},
		// TODO: Excercise 3
		// Add syncing to MediaItem for the 'read' method using client.getMediaItem
		sync: function( method, media_item, options ){
			switch( method ){
				case 'read':
				client.getMediaItem( this.id, function( error, response ){
					if ( !error ) {
						options.success( response );
					};
				} );
				break;
			}
		}
	} );

	// Represents the list of media items in the media library
	model.MediaLibrary = Backbone.Collection.extend( {
		// This collection contains wpaint.model.MediaItem elements
		model: model.MediaItem,
		// Items should be sorted by date created newest to oldest
		comparator: function( item ){
			return - item.getDateCreated();
		},
		// Sync, we only support fetching the library
		sync: function( method, media_library, options ){
			switch( method ){
				case 'read':
				// we're using the wp.getMediaLibrary XML-RPC method
				client.getMediaItems( function( error, response ){
					if ( error ) {
						// use the built in error callback for Backbone.Collection
						options.error( error );
					} else {
						// use the provided success callback for Backbone.Collection
						options.success( response );
					}
				} );
				break;
			}
		}
	} );

	// default parameters to use for XML-RPC calls
	app.api.DEFAULT_PARAMS = [blog_id, username, password];

	// Extend the client to know about WP XML-RPC methods
	/*
	wp.getMediaItems
	http://core.trac.wordpress.org/browser/tags/3.5.1/wp-includes/class-wp-xmlrpc-server.php#L3311
	
	filter: (optional) struct/object to filter which items to return
	*/
	app.api.getMediaItems = function( filter, callback ){
		// copy args to an Array
		var args = [].slice.call( arguments ),
			// rest of the arguments are the XML-RPC combine with default params
			params = ['wp.getMediaLibrary'].concat( this.DEFAULT_PARAMS ).concat( args );
		this.request.apply( this, params );
	};

	/*
	wp.getMediaItem
	http://core.trac.wordpress.org/browser/tags/3.5.1/wp-includes/class-wp-xmlrpc-server.php#L3266

	attachment_id: the attachment post's id	
	*/
	app.api.getMediaItem = function( attachment_id, callback ){
		var args = [].slice.call( arguments ),
				params = ['wp.getMediaItem'].concat( this.DEFAULT_PARAMS ).concat( args );
		this.request.apply( this, params );
	}

	/*
	metaWeblog.newMediaObject
	http://core.trac.wordpress.org/browser/tags/3.5.1/wp-includes/class-wp-xmlrpc-server.php#L4907
	data: struct/object with
	    - name: the file's name
	    - type: the mime type of the file
	    - bits: base64 encoded bits
	    - overwrite: boolean to allow overwriting exiting file (if it matches name)
	*/
	app.api.newMediaItem = function( data, callback ){
		var args = [].slice.call( arguments ),
			params = ['metaWeblog.newMediaObject'].concat( this.DEFAULT_PARAMS ).concat( args ),
			bits = data.bits;
		data.bits = function(){
			return "<base64>" + bits + "</base64>";
		}
		this.request.apply( this, params );
	}

	return app;

} )( endpoint, blog_id, username, password );
