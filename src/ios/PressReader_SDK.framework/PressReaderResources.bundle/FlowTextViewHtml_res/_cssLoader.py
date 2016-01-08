#
# Resource web loader for PD10
#

import os
import sys
import string
import re
from urllib.parse import urlparse
from sys import argv
import urllib.request
from time import gmtime, strftime


if __name__ == "__main__":
    files = ( "html5reset.css", "style-core.css", "style-textview.css", "style-radio.css")
    for f in files:
        url = "http://cache-res.pressdisplay.com/res/en-us/g1/t170896862/2/WebResource.ashx?style=%s" % (f) #production               
        print (f+" from "+url)
        reader = urllib.request.urlopen( url )
        out = open( "styles\\"+f, 'wb' )
        instr = reader.read().decode("utf-8").replace("/fonts/","../fonts/").replace("images/","../images/").encode("utf-8")
        out.write(instr)
        out.close()
        reader.close()
        print ("done")
        
        
