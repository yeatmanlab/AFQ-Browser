import os.path as op
import scipy.io as sio
import pandas as pd
import numpy as np

def nodes_table(mat_file_name, subject_ids=None, stats=None,
                out_file=None):
    """
    Create a nodes table from an AFQ `.mat` file

    Parameters
    ----------
    mat_file_name : str
        Full path to an AFQ-processed mat-file

    subject_ids : list, optional
        Identifiers for the subjects.
        Default: ['subject_001', 'subject_002,' ...]

    stats : list, optional
        List of keys for statistics to pull from the AFQ data.
        Default: pull out all of the statistics that are in the mat file.

    out_file : str
        Full path to the CSV file to be saved as output
    """
    afq = sio.loadmat(mat_file_name)['afq']
    vals = afq['vals'].item()
    tract_ids = afq['fgnames'][0][0][0]

    n_tracts = len(tract_ids)
    if stats is None:
        stats = list(vals.dtype.fields.keys())
    columns = ['subjectID', 'tractID', 'nodeID']
    columns = columns + stats
    df = pd.DataFrame(columns=columns)
    n_subjects, nodes_per_tract = vals[stats[0]][0, 0][:, 0][0].shape

    if subject_ids is None:
        # XXX Make the number of zeros flexible and depend on n_subjects:
        subject_ids = ['subject_%03d' % i for i in range(n_subjects)]

    for subject in range(len(subject_ids)):
        for tract in range(n_tracts):
            subj_df = pd.DataFrame(
                    columns=['subjectID', 'tractID', 'nodeID'],
                    data=np.array([[subject_ids[subject]] * nodes_per_tract,
                                   [tract_ids[tract][0]] * nodes_per_tract,
                                   np.arange(nodes_per_tract)]).T)
            for stat in stats:
                scalar = vals[stat][0, 0][:, tract][0][subject]
                subj_df[stat] = scalar
        df = df.append(subj_df)

    if out_file is None:
        out_file = op.join('.', 'nodes.csv')

    df.to_csv(out_file, index=False)
