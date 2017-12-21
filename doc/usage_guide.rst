.. _usage_guide:

Creating and publishing an ``AFQ-Browser`` instance
===================================================

After :ref:`installation_guide`, you can run the program on mat files generated
by AFQ_ or on the ``stats`` directory created by TRACULA (or data from other tractometry software formatted according to :ref:`dataformat`).
For an example, download this `mat file <https://github.com/yeatmanlab/AFQ-Browser/raw/master/afqbrowser/site/client/data/afq.mat>`_, and run::

    afqbrowser-assemble /path/to/afq.mat

You will be prompted to provide a title for the page, as well as a sub-title,
and you can add links from both of these (we use these links to refer back to
the paper describing the dataset, see
`this site <https://yeatmanlab.github.io/Sarica_2017>`_ for an example). This
will create a folder called ``AFQ-browser`` in your current file-system
location, containing the materials for your `AFQ-Browser` instance
(alternatively, use the ``-t`` flag to provide another file-system location as a
target).

To view the assembled website, run::

    afqbrowser-run

Per default, this will look for the instance of `AFQ-Browser` in your current
file-system location (provide another target using the ``-t`` flag). Open a
browser pointing to `http://localhost:8080 <http://localhost:8080>`_ ,
to view the visualization of these data and to interact with it (another port
can be set using the ``-p`` flag). The variables in the metadata table are
created based on the variables that are stored in the `mat file <https://github.com/yeatmanlab/AFQ/wiki#including-subject-metadata-in-the-afq-structure>`_ of the afq.mat file.


.. note:: `Binder <https://mybinder.org/>`_ integration (see :ref:`binder_integration`) will not work if you are running your instance locally. To activate Binder integration you must publish your instance to GitHub (see below).

Publishing your website
~~~~~~~~~~~~~~~~~~~~~~~~

To publish your website to GitHub you will need a GitHub account. If you don't
already have one, start by `creating a GitHub account <https://github.com/join>`_. Then run the following sequence::

    afqbrowser-assemble   # Run this only if you haven't before
    afqbrowser-publish /path/to/target/ reponame

Where ``/path/to/target`` points to the folder that was created by
``afqbrowser-assemble``, and ``reponame`` will be used to create the URL of the
website. You will be prompted for your GitHub user-name and password, and the
URL will be `https://username.github.io/reponame`, unless you also provide an
input to the optional ``-o`` flag with the name of a `GitHub organization <https://github.com/blog/674-introducing-organizations>`_ that you are a member
of (and are allowed to create new repositories for!), in which case, the website URL will be: `https://orgname.github.io/reponame`.

If you use two-factor authentication to access GitHub, you'll need to
`create a personal access token <https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/>`_
to use ``afqbrowser-publish``. After creating your token, store it in a safe
place. ``afqbrowser-publish`` will ask you for this token to login to GitHub.
Leave the password field blank to tell ``afqbrowser-publish`` to give you a
prompt for your token.

.. note:: When you publish an ``AFQ-Browser`` instance to GitHub, we also
  record your website in `AFQ Vault <http://afqvault.org>`_.
  See :ref:`long_term_preservation`.

.. _AFQ: https://github.com/yeatmanlab/AFQ
