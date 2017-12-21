.. _binder_integration:

Integration of ``AFQ-Browser`` and ``Binder``
=============================================

To facilitate further computations on data-sets published using
``AFQ-Browser``, we integrate data-sets that are published on GitHub (see :ref:`usage_guide`) with the `Binder <https://mybinder.org/>`_ service.

Binder makes the contents of a GitHub repository available through a
`Jupyter <jupyter.org>` computational notebook interface. This means that
visitors to a published ``AFQ-Browser`` instance can start computing on the
data immediately without having to download the data, or install any software.

.. note:: For further information about Binder, please read about recent
  developments in this project in `this blog post <https://elifesciences.org/labs/8653a61d/introducing-binder-2-0-share-your-interactive-research-environment>`_.


Software available on Binder
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The Binder environment automatically provisioned for ``AFQ-Browser`` instances
has `scikit-learn <http://scikit-learn.org/>`_,
`pandas <https://pandas.pydata.org>`_ and
`seaborn <https://seaborn.pydata.org/>`_
installed into it.

To add more software dependencies, you will need to edit the
``requirements.txt`` file in the GitHub (for example, see `this file <https://github.com/yeatmanlab/Sarica_2017/blob/gh-pages/requirements.txt>`_), `before` launching Binder for the first time from your instance.
