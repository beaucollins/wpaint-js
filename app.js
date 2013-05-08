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
			'mousedown' : 'startDrawing',
			'mouseup'   : 'stopDrawing',
			'mousemove' : 'draw',
			'resize'    : 'resize',
			'touchstart': 'startDrawing',
			'touchstop' : 'stopDrawing',
			'touchmove' : 'touchDraw'
		},
		/*
			Construct the <canvas> element we'll use for drawing
		*/
		initialize: function(){
			if (!this.model) this.model = new model.Layers();
			this.layers = {};
			this.dimensions = new Backbone.Model();
			this.layer_panel = new ui.LayerPanel( {el:this.options.layer_panel, model:this.model } );
			// create the <canvas> element and start it in the center of the page
			this.$canvas = $( '<div></div>' ).css( {
				left: Math.round( 0.5 * this.$el.width() ),
				top: Math.round( 0.5 * this.$el.height() ),
				visibility: 'hidden'
			} ).appendTo( this.$el );
			// register the the resize listener for the window
			$( window ).on( 'resize', _.debounce( _.bind( this.resize, this ), 10 )  );

			this.dimensions.on( 'change', this.resizeCanvas, this );
			this.model.on( 'add', this.addLayer, this );
			this.model.on( 'remove', this.removeLayer, this );
			this.model.on( 'reset', this.resetLayers, this );
			this.model.on( 'change:selected', this.selectLayer, this );

			this.touchEnabled = document.createElement( 'body' ).ontouchstart === null;
		},
		/*
			Called when the window is resized to center the canvas
		*/
		resize: function( e ){
			this.centerCanvas();
		},
		resizeCanvas: function( dimensions ){
			this.$canvas.css( dimensions.attributes );
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
			// combine all of canvases into a single canvas
			var composite = document.createElement( 'canvas' );
			composite.width = this.dimensions.get( 'width' );
			composite.height = this.dimensions.get( 'height' );
			var context = composite.getContext( '2d' );
			this.model.each( function( layer ){
				context.drawImage( layer.canvas, 0, 0, composite.width, composite.height );
			});
			// retrive the data uri, e.g. data:image/png;base64,oi3i9030ifjsad...
			var uri = composite.toDataURL(),
				// get the mime type (between ":" and ";")
				type = uri.substring( uri.indexOf( ":" ) + 1 , uri.indexOf( ";" ) ),
				// get the base64 data (eveything after the comma)
				bits = uri.substring( uri.indexOf( "," ) + 1 ),
				// struct for mw.newMediaItem
				struct = {
					type: type,
					bits: bits,
					// add the filetype so WordPress will accept it
					name: 'untitled.png'
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
		loadMediaItem: function(mediaItem){
			// detroy our current layers
			this.model.reset();
			var img = new Image();
			img.onload = _.bind( function(){
				this.$canvas.css( 'visibility', 'visible' );
				this.dimensions.set( { width:img.width, height:img.height } );
				this.model.add( { image:img, width:img.width, height:img.height } );
				this.model.add( { width:img.width, height:img.height } );
			}, this );
			img.src = mediaItem.getSrc();
		},
		newLayer: function(){
			this.model.add( this.dimensions.attributes );
		},
		addLayer: function(layer){
			this.$canvas.append( layer.canvas );
			layer.set( { selected: true } );
		},
		removeLayer: function( layer){
			$(layer.canvas).remove();
		},
		resetLayers: function( ){
			this.$canvas.children().remove();
		},
		selectLayer: function( layer, selected ){
			if ( selected ) {
				if ( this.selectedLayer ) this.selectedLayer.set( { selected: false } );
				this.selectedLayer = layer;
			};
		},
		/*
			Set a new MediaItem for the canvas to display
		*/
		setModel: function( mediaItem ){
			this.loadMediaItem( mediaItem );
		},
		/*
			mousedown event callback
		*/
		startDrawing: function( e ){
			if ( !this.selectedLayer ) return;
			e.preventDefault();
			this.drawing = true;
			this.selectedLayer.startDrawing();
		},
		/*
			mouseup event callback
		*/
		stopDrawing: function(){
			if ( !this.selectedLayer ) return;
			// this.drawing = false;
			this.drawing = false;
			this.selectedLayer.stopDrawing();
		},
		/*
			mousemove event callback
		*/
		draw: function( event ){
			if ( !this.selectedLayer ) return;
			if ( this.drawing && !this.touchEnabled ) {
				var offset = this.$canvas.offset();
				// get the top most layer
				this.selectedLayer.draw( event.pageX - offset.left, event.pageY - offset.top );
			};
		},
		touchDraw: function( event ){
			if ( !this.selectedLayer ) return;
			var offset = this.$canvas.offset();
			event.preventDefault();
			event = event.originalEvent;
			// get the top most layer
			this.selectedLayer.draw( event.pageX - offset.left, event.pageY - offset.top );
			console.log( "Moved", event );
		}
	} );

	ui.LayerPanel = Backbone.View.extend({
		initialize: function(){
			this.layers = {};
			this.model.on( 'add', this.addLayer, this );
			this.model.on( 'remove', this.removeLayer, this);
			this.model.on( 'reset', this.resetLayers, this );
		},
		removeLayer: function( layer ){
			this.layers[layer.cid].$el.remove();
			delete this.layers[layer.cid];
		},
		addLayer: function( layer ){
			// create a layer view
			var panel = new ui.LayerView( { model:layer } );
			this.$el.prepend( panel.el );
			this.layers[layer.cid] = panel;
		},
		resetLayers: function(){
			this.$el.children().remove();
			this.layers = {};
		}
	});

	ui.LayerView = Backbone.View.extend({
		tagName: 'div',
		events: {
			'click' : 'selectLayer'
		},
		initialize: function(){
			var model = this.model;
			this.model.on( 'change', this.render, this );
			this.$canvas = $( "<canvas></canvas>" );
			this.$deleteButton = $( "<a title='Delete' href='#delete'></a>" ).on( 'click', function( e ){
				e.preventDefault();
				e.stopPropagation();
				model.destroy();
			} ).appendTo( this.$el );
			var canvas = this.$canvas[0],
				context = canvas.getContext( '2d' );
				canvas.height = 50;
				canvas.width = 50;
			// render the models canvas representation into ours
			context.drawImage( this.model.canvas, 0, 0, 50, 50 );
			this.$el.append( this.$canvas );
			this.model.on( 'draw', function( canvas ){
				context.clearRect( 0, 0, 50, 50 );
				context.drawImage( canvas, 0, 0, 50, 50 );
			})
		},
		selectLayer: function( e ){
			e.preventDefault();
			this.model.set( { selected: true } );
		},
		render: function(){
			this.$el.toggleClass( 'selected', !!this.model.get( 'selected' ) );
		}
	});
	/*
		View for managing the toolbar (div.toolbar). Currently only a single button.
	*/
	ui.Toolbar = Backbone.View.extend( {
		events: {
			'click a[href="#save"]'      : 'saveImage',
			'click a[href="#add-layer"]' : 'addLayer',
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
		addLayer: function( e ){
			e.preventDefault();
			this.trigger( 'add-layer' );
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
			this.model.on( 'add', this.addItem, this );
			this.model.on( 'change:selected', this.selectItem, this );
			this.model.fetch();
		},
		selectItem: function( model, selected ){
			if ( selected ) {
				if ( this.selection ) {
					this.selection.set( {selected: false} );
				}
				this.selection = model;
				this.trigger( 'selected', model );
			}
		},
		// TODO: Excercise 2
		// create a new ui.LibraryThumb for the added item and add it to the DOM
		addItem: function( item, library, options ){
			var thumb = new ui.LibraryThumb( {model: item} ),
				index = library.indexOf( item );
			// if the index is 0, we prepend, otherwise append since new items
			// are added to the front of the list
			this.$el[index == 0 ? 'prepend' : 'append']( thumb.$el );
		}
	} );

	// TODO: Excercise 3
	// set up a click event and and have it set the model as selected
	ui.LibraryThumb = Backbone.View.extend( {
		className: 'media-thumb',
		events: {
			'click': 'select'
		},
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
			this.$img.attr( 'src', this.model.getThumbnailSrc() );
			this.$el.toggleClass( 'selected', this.model.get( 'selected' ) === true );
		},
		select: function(){
			this.model.set( {'selected': true} );
		}
	} );

	model.Layer = Backbone.Model.extend( {
		initialize: function(){
			var canvas = this.canvas = document.createElement( 'canvas' ),
					context = this.context = this.canvas.getContext( '2d' );
			canvas.width = this.get( 'width' );
			canvas.height = this.get( 'height' );
			if ( this.has( 'image' ) ) {
				context.drawImage( this.get('image'), 0, 0, canvas.width, canvas.height )
			};
		},
		startDrawing: function(){
			this.context.beginPath();
			this.context.lineWidth = 3.5;
			this.context.strokeStyle = 'hsl( 0, 100%, 50% )';
		},
		stopDrawing: function(){
			this.trigger( 'draw', this.canvas );
		},
		draw: function(x, y){
			this.context.lineTo(x, y);
			this.context.stroke();
		}
	} );

	model.Layers = Backbone.Collection.extend( {
		model: model.Layer
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
