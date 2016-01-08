
//define( [], function() {


Array.prototype.last = function() {return this[this.length-1];}


MyEvents = ( function() {
    var _api = {};

    var _pool = {}; // name: [ [obj, func], ... ]


    _api.bind = function( obj, name, func ) {
        var elem = _pool[ name ];
        if ( elem == undefined )
            elem = _pool[ name ] = [];
        else {
            for ( var i=0; i < elem.length; ++i ) {
                if ( elem[i].obj === obj && elem[i].func === func )
                    return;
            }
        }
        elem.push( {obj:obj, func:func} );
    };

    _api.unbind = function( obj, name, func ) {
        if ( name ) {
            var elem = _pool[ name ];
            if ( elem ) {
                for ( var i=0; i < elem.length; ++i ) {
                    if ( elem[i].obj === obj && elem[i].func === func ) {
                        elem.splice( i, 1 );
                        --i;
                    }
                }
            }
        }
        else if ( obj ) { // remove all object bindings
            for ( var n in _pool ) {
                var elem = _pool[ n ];
                for ( var i=0; i < elem.length; ++i ) {
                    if ( elem[i].obj === obj ) {
                        elem.splice( i, 1 );
                        --i;
                    }
                }
            }
        }
    }; 

    _api.post = function( name ) {
        var elem = _pool[ name ];
        if ( !elem )
            return;
        for ( var i=0; i < elem.length; ++i ) {
            elem[i].func.apply( null, arguments );
        }
    };

    return _api;

    window.MyEvents = MyEvents;
}());


MyTimer = (function ()
{
    var _pool = [];

    function getFreeSlot() {
        for ( var i=0; i < _pool.length; ++i ) {
            if ( !_pool[i] )
                return i;
        }
        return i;
    }

    function findTimer( timer ) {
        for ( var i=0; i < _pool.length; ++i ) {
            if ( _pool[i] && timer == _pool[i].timer )
                return i;
        }
        return -1;
    }
    
    var _api = 
    {
        setTimeout: function( func, context, timeout ) {
            var slotIdx = getFreeSlot();
            var timer = setTimeout( function() { MyTimer.callBack('+slotIdx+'); }, timeout );            
            _pool[ slotIdx ] = { func:func, context:context, timer:timer };
            return timer;
        },

        clearTimeout: function( timer ) {
            var idx = findTimer( timer );
            if ( idx != -1 ) {
                clearTimeout( timer );
                _pool[ idx ] = undefined;
            }
        },

        callBack: function( slotIdx ) {
            var slot = _pool[ slotIdx ];
            var func = slot.func;
            var context = slot.context;
            func.call( context );
            _pool[ slotIdx ] = undefined;
        }
    }

    return _api;
})();



Util = (function ()
{    
    var self = {};    

    self.commandLineParams = function() {
        var res = {};
        var url = window.location.toString();
        var sparams = url.split( '?' )[1];
        if ( sparams == undefined )
            return res;
        var params = sparams.split( '&' ); 
        for ( var i=0; i < params.length; ++i ) {
            var sp = params[ i ];
            var ap = sp.split( '=' );
            var key = ap[0];
            var val = decodeURIComponent( ap[1] );
            res[ key ] = val;
        }
        return res;
    }
    
    
    self.sign = function( i ) {
        return ( i > 0 )? 1 : ( i < 0 )? -1 : 0;
    }
    
    self.addIfGood = function( res, piece, delimiter ) {
        if ( !delimiter )
            delimiter = '';
        if ( piece && piece.length > 0 ) {
            if ( res.length > 0 )
                res += delimiter + piece;
            else
                res += piece;
        }
        return res;
    };

    self.FormatDate = function( issueId, fmt ) {
        if ( !fmt )
            fmt = 'yyyy-mm-dd';
        var res = '';
        var y = parseInt( issueId.substr(4,4) );
        var m = parseInt( issueId.substr(8,2) );
        var d = parseInt( issueId.substr(10,2) );
        for ( var i = 0; i < fmt.length; ++i ) {
            var sym = fmt[i];
            if ( 'ymd'.indexOf( sym ) >= 0 ) {
                var mod = sym;
                while ( fmt[++i] == sym )
                    mod += sym; 
                --i;
                if ( mod.indexOf('y') == 0 )
                    res += y;
                else if ( mod == 'm' ) 
                    res += m;
                else if ( mod == 'd' )
                    res += d;
                else if ( mod == 'mm' )
                    res += ( m.toString().length > 1 )? m : '0' + m;
                else if ( mod == 'dd' )
                    res += ( d.toString().length > 1 )? d : '0' + d;
            }
            else {
                res += sym;
            }
        }
        return res;
    };

    self.addJSFile = function( jsname, onload ) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        if ( (typeof onload) == 'function' )
            script.onload = onload;
        script.type = 'text/javascript';
        script.src = jsname;
        head.appendChild( script );
    };

    self.addCSSFile = function( name, onload ) {
        var head = document.getElementsByTagName('head')[0];
        var css = document.createElement('link');
        if ( (typeof onload) == 'function' )
            script.onload = onload;
        css.rel = "stylesheet";
        css.type = 'text/css';
        css.href = name;
        head.appendChild( css );
    };

    return self;
}());


var cm = new function() {

    this.Elm = function( id ) {
        var res = document.getElementById( id );
        return res;
    }

    this.Node = function(){
        var el = document.createElement(arguments[0]);
        var i=1;
        if(typeof arguments[1] == "object" && !arguments[1].nodeType){
            for(var i in arguments[1]){
                switch(i){
                    case 'class':
                        el.className = arguments[1][i];
                    break;
                    case 'innerHTML':
                        el.innerHTML = arguments[1][i];
                    break;
                    default:
                        el.setAttribute(i, arguments[1][i]);
                }
            }
            i = 2;
        }
        
        for(var ln = arguments.length; i < ln; ++i) {
            el.appendChild(/string|number/.test(typeof(arguments[i]))? document.createTextNode(arguments[i]) : arguments[i]);
        }
        return el;
    };
    
}

//});