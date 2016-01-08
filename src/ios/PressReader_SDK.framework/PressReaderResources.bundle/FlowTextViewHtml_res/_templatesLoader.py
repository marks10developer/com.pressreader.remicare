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


def tweakFile( f, path ):
    js = f.read()

    f2 = open( path, 'wb' )

    b = bytearray(b'TemplatesLoader.onloaded(')
    b += js
    b += bytearray(b');')
    f2.write( b )
    f2.close()
    

if __name__ == "__main__":
    langs = ( "en-US", "de-DE", "ru-RU", "es-ES", "fr-FR", "ar-AE", "tr-TR", "it-IT", "pt-PT", "ja-JP", "zh-tw", "he-IL")
    #langs = ( "en-US", "ru-RU" )
    no = strftime("%Y%m%d%H%M%S", gmtime())

    for lang in langs:
        #url = "http://services-dev.pressdisplay.com/test/beta/res/?id=1022&locale=%s&ts=" % (lang) #beta
        #url = "http://services-dev.pressdisplay.com/test/beta/res/?id=3416&locale=%s&MergeWith=1037&ts=" % (lang)
        url = "http://services.pressdisplay.com/services/res/?id=1&locale=%s&ts=" % (lang) #production               
        fileName = "uitemplates\\%s.jst" % lang[:2]
        print (fileName+" from "+url)
        f = urllib.request.urlopen( url )
        tweakFile( f, fileName )
        print ("done")
        f.close()
        
