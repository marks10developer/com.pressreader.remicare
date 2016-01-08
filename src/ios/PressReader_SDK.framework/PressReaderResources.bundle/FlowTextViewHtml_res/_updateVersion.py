import os
import sys
import string
from time import *
import json


def execute():
	curtime = gmtime( time() )
	years = curtime[0] - 2000
	vmonth = years * 12 + curtime[1]
	build = '2.0.%d.%02d%02d.0' % ( years, curtime[1], curtime[2] )

	print (build)    

	scriptdir = os.path.dirname(os.path.realpath(__file__)) + '/'
	print( scriptdir )

	contentName = 'pckgcfg'

	f = open( scriptdir + contentName )

	descr = json.load( f )
	f.close()

	descr['version'] = build

	newContent = json.dumps( descr, indent=2 )
	f = open( scriptdir + contentName, 'w' )
	f.write( newContent )
	f.close()


if __name__ == "__main__":
	execute()