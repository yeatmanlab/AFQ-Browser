from __future__ import absolute_import, division, print_function
import os.path as op
from os.path import join as pjoin
import glob

# Format expected by setup.py and doc/source/conf.py: string of form "X.Y.Z"
_version_major = 0
_version_minor = 2
_version_micro = ''  # use '' for first of series, number for 1 and above
_version_extra = 'dev'
# _version_extra = ''  # Uncomment this for full releases

# Construct full version string from these.
_ver = [_version_major, _version_minor]
if _version_micro:
    _ver.append(_version_micro)
if _version_extra:
    _ver.append(_version_extra)

__version__ = '.'.join(map(str, _ver))

CLASSIFIERS = ["Development Status :: 3 - Alpha",
               "Environment :: Console",
               "Intended Audience :: Science/Research",
               "License :: OSI Approved :: MIT License",
               "Operating System :: OS Independent",
               "Programming Language :: Python",
               "Topic :: Scientific/Engineering"]

# Description should be a one-liner:
description = "AFQ-Browser"
# Long description will go up on the pypi page
long_description = """

Please refer to our
`Github repo <https://github.com/yeatmanlab/AFQ-Browser>`_ repo for details

"""

NAME = "AFQ-Browser"
MAINTAINER = "Ariel Rokem"
MAINTAINER_EMAIL = "arokem@gmail.com"
DESCRIPTION = description
LONG_DESCRIPTION = long_description
URL = "http://github.com/yeatmanlab"
DOWNLOAD_URL = ""
LICENSE = "MIT"
AUTHOR = "Ariel Rokem"
AUTHOR_EMAIL = "arokem@gmail.com"
PLATFORMS = "OS Independent"
MAJOR = _version_major
MINOR = _version_minor
MICRO = _version_micro
VERSION = __version__
PACKAGE_DATA = {'afqbrowser': [pjoin('site', '*'),
                               pjoin('site', 'client', '*'),
                               pjoin('site', 'client', 'data', '*'),
                               pjoin('site', 'client', 'css', '*'),
                               pjoin('site', 'client', 'js', '*')]}
REQUIRES = ["numpy", "pandas", "scipy"]
SCRIPTS = [op.join('bin', op.split(f)[-1]) for f in glob.glob('bin/*')]
