.. _dataformat:


The AFQ-Browser data format
============================

`AFQ-Browser` supports input from two major tractometry software pipelines:
AFQ_ and Tracula_. However, data from other tractometry pipelines can also
be used in `AFQ-Browser`, if the data is converted to the following data format
specification.

Internally, `AFQ-Browser` represents its data in three different files:

1. A json file (``streamlines.json``) that contains a description of tract
trajectories in the 3D space of the anatomy, and populates the "Anatomy" panel.
This file has the following structure::

      {"tract_name1":{"coreFiber":[[x1, y1, z1],
                                    x2, y2, z2], ... ],
                      "1":[[x1, y1, z1],
                           [x2, y2, z2], ...],
                      "2":[[x1, y1, z1],
                            x1, y1, z1], ... ]},
      "tract_name2":{"coreFiber":[[x1, y1, z1],...]...},

      ...
      }

Where ``tract_name1`` and ``tract_name2`` can be replaced by keys that are the
names of the tracts that you wish to represent. Within each tract, ``coreFiber``
is a required key, and subsequent numerical keys are not required. When tract
representation ("core fiber"/"streamlines") is selected in the GUI, either the
core fibers for each tract are displayed, or all the numerically designated
streamlines for that tract. Coordinates are kept in MNI space aligned to AC-PC.

2. A csv file (``nodes.csv``) that contains information about the tract profiles
and populates the "Bundle details" panel. This table should have columns (and
headers) named ``subjectID``, ``tractID``, and ``nodeID``. The ``subjectID``
identifies a unique subject in your dataset, and it can take any string value
you want (e.g., ``patient1``), as long as it is consistent with the information
in the ``subjects.csv`` file (see below). The ``tractID`` is the same key used in
the ``streamlines.json`` file to identify the tracts (e.g., ``tract_name1``,
``tract_name2``, etc.). The ``nodeID`` runs from 0 to the n-1, where n is the
number of nodes in the tract profile for that tract. Other columns in this
table will hold the numerical values of statistics in this subject/tract/node/
combination. The headers for these columns can be named any string value that
you would like (e.g., "FA", "MD", "my_statistic", etc.).

3. A csv file (``subjects.csv``) that contains information about the subjects
and populates the "Subject metadata" panel. This file is required to have a
``subjectID`` column that matches the subject identifiers used in ``nodes.csv``
(see above). It does not require any other columns, but can include any number
of columns that describe the subjects in the study, holding numerical or string
values.

To use data generated from another source, add these data files to the
``client/data`` folder in a copy of the `site` folder from the `AFQ-Browser`
repo_.


.. _AFQ: https://github.com/yeatmanlab/afq
.. _Tracula: https://surfer.nmr.mgh.harvard.edu/fswiki/Tracula
.. _repo: https://github.com/yeatmanlab/AFQ-Browser
