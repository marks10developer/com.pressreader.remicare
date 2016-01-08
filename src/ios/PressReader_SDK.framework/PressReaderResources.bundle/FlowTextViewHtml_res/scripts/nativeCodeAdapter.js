define( ['app/platformAdapter'], function() {


var nativeCodeAdapterReal = ( function() {
    var self = {};
    var _data = {};
    _data.dataSeed = 0;

    self.call = function( cmd ) {
        var callString = 'call?cmd=' + cmd;
        if ( arguments ) {
            for ( var i = 1; i < arguments.length; ++i ) {
                if ( arguments[i].length > 0 )
                    callString += '&' + arguments[i];
            }
        }
        browserNavigate( callString );
    };


    self.datacall = function( cmd, urlparams, data ) {
        if ( window.pushDataToNativeCode ) {
            pushDataToNativeCode.apply( self, arguments );
            return;
        }
        var tokens = '';
        for ( var i=0; i < arguments.length - 2; ++i ) {
            // limit seed number to prevent running out of memory in case native code does not obtain data
            if ( ++_data.dataSeed > 1000 )
                _data.dataSeed = 0;
            var token = cmd + _data.dataSeed;
            _data[ token ] = arguments[i+2];
            tokens += ( i > 0 )? ','+token : token;
        }
        nativeCodeAdapter.call( cmd, urlparams, 'tokens='+tokens );
    };

    self.getWaitingData = function( token ) {        
        var res = _data[token];
        _data[token] = null;
        return ( typeof res == 'object' )? JSON.stringify( res ) : res;
    };

    return self;
})();

// needs for singe article view
window.nativeCodeAdapterReal = nativeCodeAdapterReal;
return nativeCodeAdapterReal;


});