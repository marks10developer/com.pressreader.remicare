

//var _loaded = false;
var swipeLock = 0;
var nativeCodeAdapter = null;

function define( a1, on ) {
    on();
}

document.addEventListener( "DOMContentLoaded", onload1, false );

var _hyphenated = true;
if ( typeof( Hyphenator ) != "undefined" ){
    _hyphenated = false;
    Hyphenator.config({
        onhyphenationdonecallback : function () {
            _hyphenated = true;
        }
    });
    Hyphenator.run();
}


function onload1() {
    document.removeEventListener( "DOMContentLoaded", onload1, false );
    nativeCodeAdapter = nativeCodeAdapterReal;
    if(_hyphenated) {
        setTimeout( Load, 500 );
    }
    else {
        setTimeout( onload1, 10 );
    }
}

browserNavigate = function( url ) {
    var iframe = document.createElement("IFRAME");
    iframe.setAttribute("src", url );
    document.documentElement.appendChild(iframe);
    iframe.parentNode.removeChild(iframe);
    iframe = null;    
};


function Preprocess1() {
    var ids = ['artTitle', 'artSubtitle' ];
    for ( var i=0; i < ids.length; ++i ) {
        var el = cm.Elm(ids[i]);
        if ( el ) {
            el.innerHTML = el.innerHTML.replace( /(.)\1{9,}/, '' );
        }
    }

}

function Load()
{
    Preprocess1();
    if ( iPad != 1 )
    {
        document.addEventListener('touchstart', touchStart, false);
        document.addEventListener('touchmove', touchMove, false);
        document.addEventListener('touchend', touchEnd, false);
        setTimeout( 'swipeLock=1', 20 );
        nativeCodeAdapter.call( 'loaded' );
    }            
    else {
        ColumnsFlower.DoFlow( colflowdef );
    }
}

function Log(message)
{
    //var e = document.getElementById("message");
    //if (e) e.innerHTML += message + "<br>";
}


//var touches = [];


function onScroll( elem )
{
    var dYscroll = window.pageYOffset - startScrollY;
  //alert( dYscroll );
    if ( dYscroll > 0 )
    {
        swipeLock=4; // disable swipe temporarily
        setTimeout( 'swipeLock=1', 1000 );
    }
//alert( swipeLock );
}

var startX, startY, startScrollY;

function touchStart(event)
{
    var touches = event.touches;
    startX = touches[0].pageX;
    startY = touches[0].pageY;
    startScrollY = window.pageYOffset;
    if ( swipeLock == 1 )
        swipeLock = 2;
}

function touchEnd(event)
{
//alert('touchend');
    swipeLock = 1;
}

function touchMove(event)
{
    var touches = event.touches;
    var dX = touches[ 0 ].pageX - startX;
    var dY = touches[ 0 ].pageY - startY;
    startX = touches[ 0 ].pageX;
    startY = touches[ 0 ].pageY;
    
    var dYscroll = window.pageYOffset - startScrollY;    

    if ( Math.abs(dYscroll) > Math.abs( dY ) )
        dy = dYscroll;
    
    //event.preventDefault();

    if ( swipeLock == 2 )
    {
        if ( Math.abs(dY) < 3 && Math.abs(dX) >= 7 )
        {
  //alert('swipe1');
            swipeLock = 3;
            setTimeout( 'callSwipe( ' + dX + ' )', 20 );
        }
    }
}

function callSwipe( dX )
{
    if ( swipeLock == 4 )
        return;

  //alert('swipe2');
    var direction = ( dX > 0 )? 'left':'right';
    nativeCodeAdapter.call( 'swipe', 'arg1=' + direction );
    //window.location = 'call?cmd=swipe&arg1='+direction;
}

function onTVImageLoad( name )
{
    var imgRemote = document.getElementById( name );
    var imgLocal = document.getElementById( name + "_local" );
    if ( imgRemote != null && imgLocal != null )
    {
        var w = imgLocal.width;
        var h = imgLocal.height;
        imgRemote.width = w;
        imgRemote.height = h;
        imgLocal.parentNode.removeChild( imgLocal );
    }
}

function toggleClass(elem, class1, class2){
    obj = document.getElementById(elem);
    obj.className = (obj.className == class1) ? class2 : class1;
}

function changeClass(elem, newClass){
    obj = document.getElementById(elem);
    if (obj.className != newClass)
        obj.className = newClass;
}

function getDirection(element){
    var result = null;
    if (element){
        if (window.getComputedStyle){
            result = window.getComputedStyle(element,null).direction;
        } else if (element.currentStyle){
            result = element.currentStyle.direction;
        }
    }

    return result;
}

function showLoading( show ) {
    var loading = document.getElementById('loading');
    if ( !loading && !show )
        return;
    if ( !loading ) {
        var loading = document.createElement( 'div' );
        loading.innerHTML = '<div id="loading" ></div>';
        document.body.appendChild( loading );
    }
    loading.style.display = (show == 1)? 'block':'none';
}



//
//
//
var ColumnsFlower = ( function() {

    function InsertToBegin ( node, elem ) {
        var child1 = node.firstChild;
        if ( child1 )
            node.insertBefore( elem, child1 );
        else
            node.appendChild( elem );
    }
                     
                     
    function InsertBefore ( node, elem, where )
    {
        if ( where )
            node.insertBefore( elem, where );
        else
            node.appendChild( elem );
    }
                     
    function InserBeforeOrInBegin( node, elem, where )
    {
        if ( where )
            node.insertBefore( elem, where );
        else
            InsertToBegin( node, elem );
    }
                     
    function IsColumnOverfull ( col, maxHeight ) {
        //var y = 0;
        var y = ( col.parentNode )? col.parentNode.offsetTop : 0;
        var over =  y + col.offsetTop + col.offsetHeight - maxHeight;
        return (over>0)? over : 0;
    }

    function ColumnHeight( col, maxHeight ) {
    	var res = maxHeight - col.getBoundingClientRect().top;
    	return res;
    }

    var _api = {

    MakeNewColumn: function ( cfg )
    {
        var columnClass = this.isrtl? cfg.columnClass + ' rtlflow' : cfg.columnClass;
        this.prevColumn = this.curColumn;
        if ( this.prevColumn )
            this.prevColumn.style.visibility = 'visible';
        this.curColumn = document.createElement("div");
        this.curColumn.className = columnClass;
        this.curColumn.style.width = cfg.columnWidth;
        this.curColumn.style.padding = cfg.padding;
        this.curColumn.id = "col_" + (++this.curColNo);
        this.curColumn.style.visibility = 'hidden';
        
        if ( this.curColNo < 2 )
           this.dstp1.appendChild( this.curColumn );
        else
            this.dst.appendChild( this.curColumn );
        
        // new column is ready. try to place previous oversized items
        if ( this.oversizedElems.length > 0 )
        {
            this.curColumn.appendChild( this.oversizedElems[0] );
            if ( IsColumnOverfull( this.curColumn, colHeight ) )
                this.curColumn.removeChild( this.oversizedElems[0] );
            else
                this.oversizedElems.shift();
        }
    },
                 
    MoveSpans2: function ( fromElem, columnTo, maxHeight, byElems ) {
        if(!fromElem._added){
            var p = document.createElement("p");
            columnTo.appendChild(p);
            columnTo = p;
            fromElem._added = true;
        }

        var counter = 0;
        for ( var i=0 ;1; ++i ) {
            var elem = fromElem.firstChild;
            if ( !elem )
                return 0; // no more elems in source node

            columnTo.appendChild( elem );
                             
            if ( ++counter < byElems )
            continue;
        
            counter = 0;
        
            if ( IsColumnOverfull( columnTo, maxHeight ) ) {
                InsertToBegin( fromElem, elem );
                if ( i == 0 )
                    fromElem._added = false;
                return 1; // column is full
            }
        }
    },

    SplitAndFill: function( fromElem, dstColumn, dstNode, maxHeight, density ) {
        var space = ColumnHeight( dstNode, maxHeight );
        // Predicate how many words can we put in current column
        var A = fromElem._parts;
        var words = A.length;

        var needWords = Math.round( space / density );

        // take N=needWords from array, wrap them into spans and set them to dstNode.innerHTML
        var subA = A.splice( 0, needWords );

        var s = '';
        for ( var i=0; i < subA.length; ++i ) {
        	s += '<span>'+subA[i]+'</span> ';
        }

        if ( dstNode === dstColumn ) {
        	dstNode = document.createElement("div");
        	dstColumn.appendChild( dstNode );
        }

        dstNode.innerHTML = s;

        // Now make a corrections
///*        
        while ( !IsColumnOverfull( dstColumn, maxHeight ) && A.length > 0 ) {
        	var span = dstNode.appendChild( document.createElement('span') );
			dstNode.appendChild( document.createTextNode(' ') );
        	span.innerText = A.splice(0,1);
        }

        while ( IsColumnOverfull( dstColumn, maxHeight ) ) {
        	var span = dstNode.lastChild;
        	dstNode.removeChild( span );
        	var t = span.innerText;
        	if ( t )
	        	A.unshift( t );
        }
//*/
        if ( A.length > 0 )
        	dstColumn._filled = 1;

        return dstColumn._filled;
    },

    getNextColumn: function( cfg ) {
    	if ( this.curColumn._filled )
    		this.MakeNewColumn( cfg );
   		return this.curColumn;
    },
                     
    DoFlow: function ( cfg )
    {        
        var start = new Date().getTime();
        var panel1 = document.getElementById( 'flowdst1' );
        this.isrtl = getDirection( panel1 ) == 'rtl';
        if ( this.isrtl )
            panel1.className = panel1.className + ' rtlflow';
        panel1.style.width = cfg.columnWidth * 2 + 'px';
        var divheader = document.getElementById( 'divheader' );
        if ( divheader )
           divheader.style.padding = cfg.padding + 'px';
        //cfg.columnWidth
        colHeight = cfg.columnHeight;
        if ( colHeight == 0 ) {
            colHeight = window.innerHeight - 20;
        }
        
        var name = cfg.elmId;
        
        this.src = cfg.elm || document.getElementById( cfg.srcelmId );
        if ( !this.src )
            return;
        
        this.dst = document.getElementById( cfg.dstelmId );
        if ( !this.dst )
            return;
        
        this.dstp1 = document.getElementById( cfg.dstelmId + 1 );
        if ( !this.dstp1 )
            this.dstp1 = this.dst;
        
        var flowDiv = document.getElementById( 'flow' );
        if ( !flowDiv )
            return;
        
        if ( flowDiv.childNodes.length > 500 ) {
            alert( flowDiv.childNodes.length );
            return;
        }
        
        this.src.style.visibility = 'hidden';

        this.flowelem = this.src.firstChild;

        for ( ; this.flowelem; this.flowelem = this.flowelem.nextSibling ) {
            if ( this.flowelem.id != 'flow' ) {
                this.dstp1.appendChild( this.flowelem.cloneNode(true) );
            }
            else {
                var srcNode = 0;
                this.right = 0;
                this.curColNo = -1;
                this.curColumn = 0;
        
                this.oversizedElems = new Array;

                var child = null;

                this.op = function() {
                    var self = this;
                    child = ( child )? child.nextSibling : this.flowelem.firstChild;
                    if ( start ) {
                        var diff = new Date().getTime() - start;
                        if ( diff > 1000 ) {
                            start = null;
                            showLoading( 1 );
                        }
                    }

                    if ( child && child.nodeName != "DIV" ) {
                        setTimeout( function() { self.op(); }, 0 );
                        return;
                    }

                    if ( IsColumnOverfull( this.curColumn, colHeight ) )
                    {
                        if ( srcNode.getAttribute('attr1') != '1' )
                        {
                            // is not dividable text div
                            this.oversizedElems.push( srcNode ); 
                            // remove from prevColumn
                            this.curColumn.removeChild( srcNode );
                        }
                    }
        
                    if ( !this.curColumn || IsColumnOverfull( this.curColumn, colHeight ) ) // need new column
                    {
                        this.MakeNewColumn( cfg );
        
                        var over = IsColumnOverfull( this.prevColumn, colHeight );

                        if ( this.prevColumn && srcNode && over && srcNode.getAttribute('attr1') == '1' )
                        {// move subelements from prev child to the new column while prev column height is greater than the limit
                        	srcNode.parentNode.removeChild( srcNode );

				            var p = document.createElement("p");
				            this.prevColumn.appendChild( p );
				            var t = srcNode.innerText;        
				            var A = srcNode._parts = t.split(" ");

                        	var textHeight = over + ColumnHeight( p, colHeight );

                            var density = textHeight / A.length;

                            var dstNode = p;
                            var dstColumn = this.prevColumn;
                            while ( 1 == this.SplitAndFill( srcNode, dstColumn, dstNode, colHeight, density ) ) {
                                dstNode = dstColumn = this.getNextColumn( cfg );
                                this.right += dstNode.offsetWidth;
                            }
                        }
        
                        //right = this.curColumn.offsetLeft + this.curColumn.offsetWidth;
                        this.right += this.curColumn.offsetWidth;
                    }
        
                    if ( this.curColumn.innerText.length > 0 )
                    this.curColumn.appendChild( document.createElement("p") );
        
                    if ( !child ) {
                        this.finalize();
                        return;
                    }
                    srcNode = child.cloneNode(true);
                    //srcNode.className = cfg.elemclass;
                    this.curColumn.appendChild( srcNode );
                    setTimeout( function() { self.op(); }, 0 );
                }
                this.op();
            }            
        }        
    },

    finalize: function() {
        showLoading( 0 );
        this.src.parentNode.removeChild( this.src );        
        this.dst.style.width = this.right + "px";
        window.scrollTo( 0, 0 );
        nativeCodeAdapter.call( 'loaded' );
        this.curColumn.style.visibility = 'visible';
    },

    relayout: function() {
        var saved = [];
        for ( var elem = this.dst.lastChild; elem; elem = this.dst.lastChild ) {
            this.dst.removeChild( elem );
            saved.push( elem );
        }
        for ( var i=0; i < saved.length; ++i ) {
            this.dst.appendChild( saved[i] );
        }
    },
 
    GetFirstSpanOrTextInColumn: function( col )
    {
        for( var el = col.firstChild; el; el = el.nextSibling )
        {
            if ( el.nodeType == 3 || el.nodeName == "SPAN" )
            return el;
        }
        
        return 0;
    }
                
};
                     
    return _api;
}());

