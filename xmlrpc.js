/*
	XMLRPC client implementation. To make an XML-RPC request to an endpoint:

		// Creates xn XMLRPC.Client that communicates with the given URL
		var client = xmlrpc( "http://example.wordpress.com/xmlrpc.php" );

		// Define a callback function for the request, receives two parameters
		// error: error message if there was an error
		// response: the decoded XML reponse
		var responseHandler = function( error, response ){
			if( error ){
				console.error( error, response );
			} else {
				console.log( response );
			}
		};

		// To make a request, provide the remote method's name, the arguments
		// for the remote procedure and a callback that is invoked when the
		// procedure has completed
		client.request( 'wp.getPosts', blog_id, username, password, responseHandler );

*/
var xmlrpc = ( function( module ){

if ( !module ) module = {};

var XMLRPC = module.XMLRPC = function( endpoint ){
	return new XMLRPC.Client( endpoint );
}

XMLRPC.Client = function( endpoint ){
	var Builder = XMLRPC.Builder,
			Parser	= XMLRPC.Parser,
			FaultError = XMLRPC.FaultError;
	this.endpoint = endpoint;

	this.request = function(){
		args = Array.prototype.slice.call( arguments )
		callback = args.pop();
		method = args.shift()
		params = args;

		if ( typeof( callback ) !== 'function' ) throw( "No valid callback defined" );

		var req = new XMLHttpRequest();
		req.addEventListener( 'load', function( ev ){
			var error = null;
			if( req.status === 200 ){
				try {
					var response = Parser.parse( req.response );
					if( response.faultCode ) throw( response.faultString );
				} catch( e ) {
					error = e;
				}
				callback( error, response );
			} else {
				callback( "Server reterned response code: " + req.status );
			}
		} );
		req.open( 'POST', this.endpoint );
		req.send( Builder.marshal( method, args ));

		return req;
	}

}

XMLRPC.Encoder = function( fn ){
	this.fn = fn;
}

XMLRPC.Encoder.prototype.encode = function( object, builder ){
	return this.fn( object, builder );
}

XMLRPC.Builder = function( methodName, methodParams, encoders ){
	this.methodName = methodName;
	this.methodParams = methodParams;
	if ( !encoders ) encoders = [];
	this.encoders = encoders.concat( XMLRPC.Builder.baseEncoders || [] );
}

XMLRPC.Builder.marshal = function( methodName, methodParams ){
	return ( new XMLRPC.Builder( methodName, methodParams )).toString();
}

XMLRPC.Builder.prototype.toString = function(){
	return "<?xml version=\"1.0\"?>\n" +
		"<methodCall>\n<methodName>" + this.methodName + "</methodName>\n" +
		"<params>\n" + this.buildParams( this.methodParams ) + "</params>\n</methodCall>";
}

XMLRPC.Builder.prototype.buildParams = function( params ){
	xml = "";
	for ( var i=0; i < params.length; i++ ) {
		xml += "<param><value>" + this.encode( params[i] ) +	"</value></param>\n";
	};
	return xml;
}

XMLRPC.Builder.prototype.encode = function( param ){
	var x = XMLRPC.Builder;
	for ( var i=0; i < this.encoders.length; i++ ) {
		var encoded = this.encoders[i].encode( param, this );
		if ( encoded ) {
			return encoded;
		}
	};
	throw( "Don't know how to encode " + param.constructor + ": " + JSON.stringify( param ));
}

var NumberEncoder = XMLRPC.Builder.NumberEncoder = new XMLRPC.Encoder( function( param ){
	if ( this.isNumber( param )) {
		if ( this.isInt( param )) {
			return "<i4>" + param + "</i4>";
		}else{
			return "<double>" + param + "</double>";
		}
	};
} );

NumberEncoder.isNumber = function( param ){
	return ( typeof( param ) == 'number' || param instanceof Number );
}

NumberEncoder.isInt = function( param ){
	return Math.round( param ) == param;
}

var DateEncoder = XMLRPC.Builder.DateEncoder = new XMLRPC.Encoder( function( param ){
	if ( this.isDate( param )) {
		return "<dateTime.iso8601>" + this.dateToIso8601( param ) + "</dateTime.iso8601>";
	};
} );

DateEncoder.dateToIso8601 = function( date ){
	year = date.getUTCFullYear();
	month = date.getUTCMonth() + 1;
	if ( month < 10 ) month = "0" + month;		 
	day = date.getUTCDate();
	if ( day < 10 ) day = "0" + day;		 
	var minutes = date.getUTCMinutes();
	if ( minutes < 10 ) minutes = "0" + minutes; 
	var seconds = date.getUTCSeconds();
	if ( seconds < 10 ) seconds = "0" + seconds;	
	var hrs = date.getUTCHours()
	if ( hrs < 10 ) hrs = "0" + hrs;
	time = hrs + ':' + minutes + ':' + seconds;
	return " " + year + month + day + "T" + time;
}

DateEncoder.isDate = function( param ) {
	if ( param == null ) return false;
	return ( param instanceof Date || param.__proto__ instanceof Date || param.__proto__.constructor.name == 'Date' );
}

var StringEncoder = XMLRPC.Builder.StringEncoder = new XMLRPC.Encoder( function( param ){
	if ( this.isString( param )) {
		return "<string><![CDATA[" + param + "]]></string>";
	};
} );

StringEncoder.isString = function( param ){
	return typeof( param ) == 'string' || param.constructor == String;
}

var StructEncoder = XMLRPC.Builder.StructEncoder = new XMLRPC.Encoder( function( param, builder ){
	if ( this.isObject( param )) {
		var struct = "<struct>";
		for ( key in param ) {
			struct += "<member>";
			struct += "<name>";
			struct += key;
			struct += "</name>";
			struct += "<value>";
			struct += builder.encode( param[key] );
			struct += "</value>";
			struct += "</member>";
		};
		return struct + "</struct>";
	};
} );

StructEncoder.isObject = function( param ){
	return ( param instanceof Object || param.constructor == Object );
}

var ArrayEncoder = XMLRPC.Builder.ArrayEncoder = new XMLRPC.Encoder( function( param, builder ){
	if ( this.isArray( param )) {
		var array = "<array>\n<data>\n";
			for ( var i=0; i < param.length; i++ ) {
				array += "<value>" + builder.encode( param[i] ) + "</value>\n";
			};
		array += "</data>\n</array>\n";
		return array;
	};
} );

ArrayEncoder.isArray = function( param ){
	return Array.isArray( param );
}

var CallbackEncoder = XMLRPC.Builder.CallbackEncoder = new XMLRPC.Encoder( function( param, builder ){
	if ( this.isFunction( param )) {
		return param( param, builder );
	};
} );

CallbackEncoder.isFunction = function( param ){
	return typeof( param ) == 'function';
}

XMLRPC.Builder.baseEncoders = [
	ArrayEncoder,
	CallbackEncoder,
	StringEncoder,
	NumberEncoder,
	DateEncoder,
	StructEncoder
];

XMLRPC.Parser = function( string ){

	//TODO: clean the document with tidy. I've not found any js implementation of HTML tidy. this is bad.
	//NOTE: the DOMParser object is an HTML Dom parser, not XML, so it does not require "valid" XML so we may not need HTML tidy.

	//remove the BOM bytes, white spaces
	var cleaned = XMLRPC.Parser.protectStrings( XMLRPC.Parser.cleanBOM( XMLRPC.Parser.cleanDocument( string )) );
	this.document = doc = new DOMParser().parseFromString( cleaned, 'text/xml' );
	//console.log( "Parsed DOM", doc );
}

XMLRPC.Parser.parse = function( string ){
	return ( new XMLRPC.Parser( string )).toObject();
}

// prevents empty text nodes. and garbage between non-content XML-RPC nodes
XMLRPC.Parser.cleanDocument = function( string ){
	var open, pairs = [
		['methodResponse', 'params'],
		['params', 'param'],
		['param', 'value'],
		['array', 'data'],
		['struct', 'member']
	], open;
	var values = ['array','string', 'i4', 'int', 'dateTime\\.iso8601', 'double', 'struct'];
	pairs.push( ['value', values.join( "|" )] );
	var pair, reg;
	for ( var i=0; i < pairs.length; i++ ) {
		pair = pairs[i];
		open = new RegExp( "<" + pair[0] + ">.*?<( " + pair[1] + " )>",'gmi' );
		string = string.replace( open,"<"+pair[0]+"><$1>" );
	};

	return string.replace( />\n[\s]+\n</g, '><' );
}

// Removes all characters before the opening XLM declaration
XMLRPC.Parser.cleanBOM = function( string ){
	var leading_removed = string.substring( string.indexOf( "<" ));
	return leading_removed.replace( /^[^<]{0,}<\?xml([^>]+)>[^<]+<methodResponse/, "<?xml version=\"1.0\" ?>\n<methodResponse" );
}

// wrap the strings in <![CDATA[ ]]>
// We are treating all string values as potentially malformed XML. The parser will not attempt to process any of the
// potentially dangerous copy
XMLRPC.Parser.protectStrings = function( string ){
	var cleaned = string.replace( /<string>([\s]+<\!\[CDATA\[)?/gi, "<string><![CDATA[" ).replace( /<\/string>/gi, "]]></string>" );
	return cleaned;

}

// TODO: Remove XPath and start using querySelector since we're dealing with a DOM object
XMLRPC.Parser.prototype.toObject = function(){
	// the the method response value
	var fault = this.queryDocument( '/methodResponse/fault/value/*' )[0];
	if( fault ){
		this.fault = true;
		return this.parse( fault );
	}

	//checks for DOM fault
	fault = this.document.getElementsByTagName( "parsererror" )[0];
	if( fault ){
		this.fault = true;
		return {"faultCode":32700,"faultString":"Parse Error, not well formed"};
	}

	var value = this.queryDocument( '/methodResponse/params/param/value/*' )[0];
	return this.parse( value );
}

// TODO: Remove XPath and start using querySelector since we're dealing with a DOM object
XMLRPC.Parser.prototype.queryDocument = function( xpath, node ){
	var results = [];
	var query = this.document.evaluate( xpath, node || this.document, null,
								XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null );
	for ( var i = 0, length = query.snapshotLength; i < length; i++ )
		results.push( query.snapshotItem( i ));
	return results;
}

// TODO: Remove XPath and start using querySelector since we're dealing with a DOM object
XMLRPC.Parser.prototype.parse = function( node ){

	switch( node.nodeName ){

		case 'array':
			var children = this.queryDocument( './data/value/*', node );
			var array = [];
			for ( var i=0; i < children.length; i++ ) {
				children[i]
				array.push( this.parse( children[i] ));
			};
			return array;
			break;

		case 'struct':
			var struct = {};
			var children = this.queryDocument( './member', node );
			for ( var i=0; i < children.length; i++ ) {
				var name = this.queryDocument( './name', children[i] )[0];
				var value = this.queryDocument( './value/*', children[i] )[0];
				struct[name.firstChild.nodeValue] = this.parse( value );
			};
			return struct;
			break;

		case 'string':
			var s = node.firstChild ? node.firstChild.nodeValue : '';
			s = s.replace( /&amp;([a-z]+|\#[\d]+);/ig, '&$1;' ).replace( /&gt;/gi,'>' ).replace( /&lt;/gi,'<' ).replace( /&quot;/gi,'"' );
			return s.split( '&#039;' ).join( "'" );
			break;

		case 'boolean':
			return node.firstChild ? node.firstChild.nodeValue == "1" : false ;
			break;

		case 'i4':
		case 'int':
		case 'double':
			return node.firstChild ? parseInt( node.firstChild.nodeValue ) : null;
			break;

		case 'dateTime.iso8601':
			return node.firstChild ? Date.fromIso8601( node.firstChild.nodeValue ) : null;
			break;

		default:
			throw( "Don't know how to parse node: " + node.nodeName );
			break;

	}
}

/** 
 * Date
 */

 /**
* <p>Convert a GMT date to ISO8601.</p>
* @return
*		<code>String</code> with an ISO8601 date.
*/
// Date.prototype.toIso8601 = function() {
//	 console.log( "Encoding date", this, this.getUTCFullYear );
//	 year = this.getUTCFullYear();
//	 month = this.getUTCMonth() + 1;
//	 if ( month < 10 ) month = "0" + month;			
//	 day = this.getUTCDate();
//	 if ( day < 10 ) day = "0" + day;			
//	 time = this.getUTCHours() + ':' + this.getUTCMinutes() + ':' + this.getUTCSeconds();
//	 return year + month + day + "T" + time;
// };

/**
* <p>Convert ISO8601 date to GMT.</p>
* @param value
*		ISO8601 date.
* @return
*		GMT date.
*/
Date.fromIso8601 = function( value ) {
	year = value.substr( 0,4 ); 
	month = value.substr( 4,2 );
	day = value.substr( 6,2 ); 
	hour = value.substr( 9,2 ); 
	minute = value.substr( 12,2 ); 
	sec = value.substr( 15,2 );
	var d = new Date( Date.UTC( year, month - 1, day, hour, minute, sec, 0 ));
	return d;
};

/** 
 * Base64
 */
function Base64( value ) {	
	Base64.prototype.bytes = value;
};

/** <p>Base64 characters map.</p> */
Base64.CHAR_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

/**
* <p>Encode the object bytes using base64 algorithm.</p>
* @return
*		Encoded string.
*/
Base64.prototype.encode = function() {
	if( typeof btoa == "function" )
		this.bytes = btoa( this.bytes );
	else {
		var _byte = new Array(), _char = new Array(), _result = new Array();
		var j = 0;
	for ( var i = 0; i < this.bytes.length; i += 3 ) {
			_byte[0] = this.bytes.charCodeAt( i );
		_byte[1] = this.bytes.charCodeAt( i + 1 );
		_byte[2] = this.bytes.charCodeAt( i + 2 );
		_char[0] = _byte[0] >> 2;
		_char[1] = ( (_byte[0] & 3 ) << 4 ) | ( _byte[1] >> 4 );
		_char[2] = ( (_byte[1] & 15 ) << 2 ) | ( _byte[2] >> 6 );
			_char[3] = _byte[2] & 63;		
		if( isNaN( _byte[1] ))
			_char[2] = _char[3] = 64;
		else 
		if( isNaN( _byte[2] ))
			_char[3] = 64;
		_result[j++] = Base64.CHAR_MAP.charAt( _char[0] ) + Base64.CHAR_MAP.charAt( _char[1] ) 
					 + Base64.CHAR_MAP.charAt( _char[2] ) + Base64.CHAR_MAP.charAt( _char[3] );
	}	 
		this.bytes = _result.join( "" );
	}
	return this.bytes;
};

XMLRPC.FaultError = function( response ){
	this.response = response;

}

XMLRPC.FaultError.prototype.toString = function(){
	return this.response.faultString;
}

/**
* <p>Decode the object bytes using base64 algorithm.</p>
* @return
*		Decoded string.
*/
Base64.prototype.decode = function() {
	if( typeof atob == "function" ) 
		this.bytes = atob( this.bytes );
	else {
	var _byte = new Array(), _char = new Array(), _result = new Array();
	var j = 0;
	while ( (this.bytes.length % 4 ) != 0 )
		this.bytes += "=";
		for ( var i = 0; i < this.bytes.length; i += 4 ) {
		_char[0] = Base64.CHAR_MAP.indexOf( this.bytes.charAt( i ));
		_char[1] = Base64.CHAR_MAP.indexOf( this.bytes.charAt( i + 1 ));
		_char[2] = Base64.CHAR_MAP.indexOf( this.bytes.charAt( i + 2 ));
		_char[3] = Base64.CHAR_MAP.indexOf( this.bytes.charAt( i + 3 ));
		_byte[0] = ( _char[0] << 2 ) | ( _char[1] >> 4 );
		_byte[1] = ( (_char[1] & 15 ) << 4 ) | ( _char[2] >> 2 );
		_byte[2] = ( (_char[2] & 3 ) << 6 ) | _char[3];
		_result[j++] = String.fromCharCode( _byte[0] );
		if( _char[2] != 64 ) 
			_result[j++] = String.fromCharCode( _byte[1] );
		if( _char[3] != 64 ) 
			_result[j++] = String.fromCharCode( _byte[2] ); 
	}
	this.bytes = _result.join( "" );
	}
	return this.bytes;
};

	return XMLRPC;

} )();
