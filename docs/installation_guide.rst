.. _installation_guide:


Installing ``AFQ-Browser``
==========================

Installing the release version
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The released version of the software is the one that is officially supported,
and if you are getting started with ``AFQ-Browser``, this is probably where you
should get started

AFQ-browser depends on numpy_, pandas_ and scipy_. The `publish` mechanisms also
requires  PyGithub_ and GitPython_.

These dependencies should all be installed automatically when the software is
installed. To install it, in a shell or command line, issue the following::

  pip install AFQ-Browser

One easy way to install these, is by installing the Anaconda_ Python
distribution,

Installing the development version
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The development version is probably less stable, but might include new features and fixes. There are two ways to install this version. The first uses ``pip``::

  pip install git+https://github.com/yeatmanlab/AFQ-Browser.git

The other requires that you clone the source code to your machine::

  git clone https://github.com/yeatmanlab/AFQ-Browser.git

Then, change your working directory into the top-level directory of this repo and issue::

  python setup.py install

.. _numpy: http://numpy.org
.. _scipy: http://scipy.org
.. _pandas: http://pandas.pydata.org/
.. _GitPython: http://gitpython.readthedocs.io/
.. _PyGithub: http://pygithub.github.io/PyGithub/v1/index.html
.. _Anaconda: https://www.continuum.io/downloads
