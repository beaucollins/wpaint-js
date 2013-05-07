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
